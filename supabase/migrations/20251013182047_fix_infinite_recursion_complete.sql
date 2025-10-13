/*
  # Fix Infinite Recursion in is_admin() Function and RLS Policies

  ## Problem
  The current RLS policies cause infinite recursion when checking if a user is an admin:
  1. User queries user_profiles table to get their profile
  2. RLS policy "Admins can view all profiles" calls is_admin(auth.uid())
  3. is_admin() queries user_profiles table to check role
  4. This triggers RLS policies again -> infinite recursion
  5. Query fails, role defaults to "member"

  ## Solution
  1. Drop all policies that depend on is_admin()
  2. Recreate is_admin() function with proper RLS bypass
  3. Recreate all policies in the correct order
  4. Ensure users can always read their own profile first

  ## Changes
  1. Drop all dependent policies
  2. Drop and recreate is_admin() function with explicit RLS bypass
  3. Recreate policies with proper ordering
*/

-- Step 1: Drop all policies that depend on is_admin() function
-- User profiles policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Content policies
DROP POLICY IF EXISTS "Content visibility by role and tier" ON content;
DROP POLICY IF EXISTS "Admins can view all content" ON content;
DROP POLICY IF EXISTS "Admins can insert content" ON content;
DROP POLICY IF EXISTS "Admins can update content" ON content;
DROP POLICY IF EXISTS "Admins can delete content" ON content;
DROP POLICY IF EXISTS "Users can view content based on their tier" ON content;

-- Communities policies
DROP POLICY IF EXISTS "Admins can insert communities" ON communities;
DROP POLICY IF EXISTS "Admins can update communities" ON communities;
DROP POLICY IF EXISTS "Admins can delete communities" ON communities;

-- Settings policies (if they exist)
DROP POLICY IF EXISTS "Admins can view settings" ON settings;
DROP POLICY IF EXISTS "Admins can update settings" ON settings;

-- Step 2: Drop and recreate is_admin function with explicit RLS bypass
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Explicitly bypass RLS by using SECURITY DEFINER
  -- This function runs with the privileges of the function creator
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id;
  
  RETURN COALESCE(user_role = 'admin', false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- Step 3: Recreate user_profiles SELECT policies
-- Drop existing ones first
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in same community" ON user_profiles;

-- Recreate in correct order (simple checks first)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view profiles in same community"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    community_id IS NOT NULL 
    AND community_id IN (
      SELECT community_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Step 4: Recreate user_profiles UPDATE policies
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Step 5: Recreate content policies
CREATE POLICY "Users can view content based on their tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    CASE 
      WHEN required_tier = 'silver' THEN true
      WHEN required_tier = 'gold' THEN
        EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN communities c ON up.community_id = c.id
          WHERE up.id = auth.uid()
          AND c.membership_tier = 'gold'
        )
    END
  );

CREATE POLICY "Admins can view all content"
  ON content FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update content"
  ON content FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete content"
  ON content FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Step 6: Recreate communities policies
CREATE POLICY "Admins can insert communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete communities"
  ON communities FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Step 7: Recreate settings policies if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view settings"
      ON settings FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()))';
    
    EXECUTE 'CREATE POLICY "Admins can update settings"
      ON settings FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()))';
  END IF;
END $$;
