/*
  # Fix Circular RLS Dependencies - Complete Solution

  ## Problem
  Multiple RLS policies cause infinite recursion and 500 errors:
  1. User profiles policy joins to user_profiles itself (circular)
  2. Content policy joins user_profiles and communities (circular)
  3. Duplicate policies on communities table
  
  ## Solution
  1. Create additional helper functions that bypass RLS
  2. Replace problematic policies with versions using helper functions
  3. Remove duplicate policies
  4. Maintain security while breaking circular dependencies

  ## Changes
  1. New helper functions:
     - is_org_manager(): Check if user is any organization manager
     - get_community_tier(): Get community tier without RLS
  2. Fix user_profiles policies to avoid self-reference
  3. Fix content policies to use helper functions
  4. Remove duplicate communities policies
  
  ## Security
  - All helper functions are SECURITY DEFINER with row_security OFF
  - Functions only return specific authorization data
  - No sensitive data leakage
  - Maintains all security requirements
*/

-- ============================================================================
-- STEP 1: Create additional helper functions
-- ============================================================================

-- Check if user is an organization manager (any org)
CREATE OR REPLACE FUNCTION is_org_manager(user_id uuid)
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
    WHERE organization_managers.user_id = is_org_manager.user_id
  ) INTO is_manager;
  
  RETURN COALESCE(is_manager, false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Get community membership tier without triggering RLS
CREATE OR REPLACE FUNCTION get_community_tier(comm_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  tier text;
BEGIN
  SELECT membership_tier INTO tier
  FROM public.communities
  WHERE id = comm_id
  LIMIT 1;
  
  RETURN tier;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- ============================================================================
-- STEP 2: Fix user_profiles RLS policies - remove circular dependency
-- ============================================================================

-- Drop the problematic org manager policy that causes circular dependency
DROP POLICY IF EXISTS "Org Managers can view user profiles in their org" ON user_profiles;

-- Recreate with helper functions to avoid circular RLS
CREATE POLICY "Org Managers can view user profiles in their org"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    -- User must be an org manager
    is_org_manager(auth.uid())
    AND 
    -- And the profile being viewed must be in a community within their org
    EXISTS (
      SELECT 1 
      FROM public.organization_managers om
      JOIN public.communities c ON c.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND c.id = user_profiles.community_id
    )
  );

-- ============================================================================
-- STEP 3: Fix content RLS policies - replace joins with helper functions
-- ============================================================================

-- Drop the problematic content policy
DROP POLICY IF EXISTS "Users can view content based on role and tier" ON content;

-- Recreate with helper functions to avoid circular dependencies
CREATE POLICY "Users can view content based on role and tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    -- Content must be published
    status = 'published'
    AND
    (
      -- Admins and org managers can see all content
      get_user_role(auth.uid()) IN ('admin', 'organization_manager')
      OR
      -- Silver tier: everyone can see
      required_tier = 'silver'
      OR
      -- Gold tier: only users in gold communities can see
      (
        required_tier = 'gold'
        AND get_community_tier(get_user_community_id(auth.uid())) = 'gold'
      )
    )
  );

-- ============================================================================
-- STEP 4: Remove duplicate policies on communities table
-- ============================================================================

-- Remove old duplicate policies that cause circular dependencies
DROP POLICY IF EXISTS "Users can view own community" ON communities;
DROP POLICY IF EXISTS "Admins can view all communities" ON communities;
DROP POLICY IF EXISTS "Community managers can view managed communities" ON communities;
DROP POLICY IF EXISTS "Org Managers can view communities in their org" ON communities;
DROP POLICY IF EXISTS "Org Managers can update communities in their org" ON communities;

-- Keep these policies (they already exist and use helper functions):
-- - "Users can view their community" (uses get_user_community_id)
-- - "Community managers can view their communities" (uses is_community_manager_for)
-- - "Organization managers can view their org's communities" (uses is_org_manager_for)
-- - "Organization managers can manage their org's communities" (uses is_org_manager_for)
-- - "Authenticated users can view communities" (allows viewing for access code validation)
-- - Admin policies (using is_admin function)

-- ============================================================================
-- STEP 5: Grant execute permissions on new helper functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION is_org_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_tier(uuid) TO authenticated;
