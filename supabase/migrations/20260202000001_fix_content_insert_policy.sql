/*
  # Fix Content Insert RLS Policy for Admins
  
  ## Problem
  Admins are getting RLS policy violation errors when trying to insert content.
  The issue is that the is_admin() function may not be properly bypassing RLS
  or the policy is not correctly evaluating admin status.
  
  ## Solution
  1. Ensure is_admin() function exists and properly bypasses RLS
  2. Recreate the content INSERT policy with explicit admin check
  3. Use SECURITY DEFINER function to bypass RLS on user_profiles
  
  ## Changes
  - Recreate is_admin() helper function with row_security OFF
  - Drop and recreate "Admins can insert content" policy
  - Ensure proper RLS bypass for admin checks
*/

-- ============================================================================
-- STEP 1: Ensure is_admin() function exists with proper RLS bypass
-- ============================================================================

-- Create parameterless version that checks current user
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_role = 'admin', false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Also ensure parameterized version exists for other uses
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id
  LIMIT 1;
  
  RETURN COALESCE(user_role = 'admin', false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- ============================================================================
-- STEP 2: Recreate content INSERT policy with proper admin check
-- ============================================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can insert content" ON content;

-- Recreate with explicit admin check
CREATE POLICY "Admins can insert content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin()
  );

-- ============================================================================
-- STEP 3: Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;

-- ============================================================================
-- STEP 4: Verify other admin content policies are correct
-- ============================================================================

-- Ensure UPDATE policy exists
DROP POLICY IF EXISTS "Admins can update content" ON content;
CREATE POLICY "Admins can update content"
  ON content FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Ensure DELETE policy exists
DROP POLICY IF EXISTS "Admins can delete content" ON content;
CREATE POLICY "Admins can delete content"
  ON content FOR DELETE
  TO authenticated
  USING (is_admin());

-- Ensure SELECT policy for admins exists
DROP POLICY IF EXISTS "Admins can view all content" ON content;
CREATE POLICY "Admins can view all content"
  ON content FOR SELECT
  TO authenticated
  USING (is_admin());
