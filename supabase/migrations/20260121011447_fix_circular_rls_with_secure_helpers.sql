/*
  # Fix Circular RLS Dependencies with Secure Helper Functions

  ## Problem
  Infinite recursion occurs when querying user_profiles with joins to communities,
  because the communities RLS policy queries user_profiles again, creating a loop.

  ## Solution
  Create SECURITY DEFINER helper functions that bypass RLS to break circular dependencies.
  These functions are secure because they:
  1. Only return specific data needed for authorization checks
  2. Use SET row_security = 'off' to bypass RLS within the function
  3. Use SET search_path for security
  4. Are marked STABLE (no side effects)

  ## Changes
  1. Create helper functions to get user data without triggering RLS
  2. Update communities policies to use helper functions
  3. Update community_pdfs policies to use helper functions
  4. All other policies remain unchanged

  ## Security Notes
  - Helper functions only return boolean/uuid values for authorization
  - Functions are SECURITY DEFINER but limited in scope
  - No data leakage - only returns what's needed for access control
*/

-- ============================================================================
-- STEP 1: Create secure helper functions that bypass RLS
-- ============================================================================

-- Get user's community_id without triggering RLS on user_profiles
CREATE OR REPLACE FUNCTION get_user_community_id(user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  comm_id uuid;
BEGIN
  SELECT community_id INTO comm_id
  FROM public.user_profiles
  WHERE id = user_id
  LIMIT 1;
  
  RETURN comm_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Check if user is a community manager for a specific community
CREATE OR REPLACE FUNCTION is_community_manager_for(user_id uuid, comm_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  is_manager boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.community_managers
    WHERE community_managers.user_id = is_community_manager_for.user_id
    AND community_managers.community_id = is_community_manager_for.comm_id
  ) INTO is_manager;
  
  RETURN COALESCE(is_manager, false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Check if user is an organization manager for a specific organization
CREATE OR REPLACE FUNCTION is_org_manager_for(user_id uuid, org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  is_manager boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.organization_managers
    WHERE organization_managers.user_id = is_org_manager_for.user_id
    AND organization_managers.organization_id = is_org_manager_for.org_id
  ) INTO is_manager;
  
  RETURN COALESCE(is_manager, false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- ============================================================================
-- STEP 2: Update communities table policies to use helper functions
-- ============================================================================

-- Drop the problematic policy that causes circular dependency
DROP POLICY IF EXISTS "Users can view their community" ON communities;

-- Recreate with helper function to avoid circular RLS
CREATE POLICY "Users can view their community"
  ON communities FOR SELECT
  TO authenticated
  USING (
    id = get_user_community_id(auth.uid())
  );

-- Update community managers policy to use helper function
DROP POLICY IF EXISTS "Community managers can view their communities" ON communities;

CREATE POLICY "Community managers can view their communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    is_community_manager_for(auth.uid(), id)
  );

-- Update organization managers policy to use helper function
DROP POLICY IF EXISTS "Organization managers can view their org's communities" ON communities;

CREATE POLICY "Organization managers can view their org's communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND is_org_manager_for(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS "Organization managers can manage their org's communities" ON communities;

CREATE POLICY "Organization managers can manage their org's communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND is_org_manager_for(auth.uid(), organization_id)
  )
  WITH CHECK (
    organization_id IS NOT NULL 
    AND is_org_manager_for(auth.uid(), organization_id)
  );

-- ============================================================================
-- STEP 3: Update community_pdfs policies to use helper functions
-- ============================================================================

DROP POLICY IF EXISTS "Users can view PDFs from their community" ON community_pdfs;

CREATE POLICY "Users can view PDFs from their community"
  ON community_pdfs FOR SELECT
  TO authenticated
  USING (
    community_id = get_user_community_id(auth.uid())
  );

DROP POLICY IF EXISTS "Community managers can manage their community PDFs" ON community_pdfs;

CREATE POLICY "Community managers can manage their community PDFs"
  ON community_pdfs FOR ALL
  TO authenticated
  USING (
    is_community_manager_for(auth.uid(), community_id)
  )
  WITH CHECK (
    is_community_manager_for(auth.uid(), community_id)
  );

-- ============================================================================
-- STEP 4: Grant execute permissions on helper functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_community_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_community_manager_for(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_manager_for(uuid, uuid) TO authenticated;
