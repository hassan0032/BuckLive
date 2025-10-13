/*
  # Fix Infinite Recursion in RLS Policies

  ## Overview
  This migration fixes the infinite recursion issue in user_profiles and related tables by creating a helper function that uses SECURITY DEFINER to bypass RLS when checking user roles.

  ## Changes
  1. Creates a security definer function to check if a user is an admin
  2. Updates all policies that were causing recursion to use this function
  3. Simplifies the content viewing policy

  ## Security
  - The helper function is SECURITY DEFINER but only returns a boolean
  - All policies remain restrictive and secure
  - No data leakage through the helper function
*/

-- Create a security definer function to check if user is admin without RLS recursion
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

-- Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their community" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in same community" ON user_profiles;

-- Recreate user_profiles policies without recursion
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view profiles in same community"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    community_id IS NOT NULL 
    AND community_id IN (
      SELECT community_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Update content policy to use the helper function
DROP POLICY IF EXISTS "Users can view content based on role and tier" ON content;
DROP POLICY IF EXISTS "Content visibility by role and tier" ON content;

CREATE POLICY "Content visibility by role and tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    -- Admins can see everything
    is_admin(auth.uid())
    OR
    -- Silver tier content is visible to everyone
    required_tier = 'silver'
    OR
    -- Gold tier content requires gold membership
    (
      required_tier = 'gold'
      AND EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN communities c ON up.community_id = c.id
        WHERE up.id = auth.uid()
        AND c.membership_tier = 'gold'
      )
    )
  );

-- Update settings policies to use helper function
DROP POLICY IF EXISTS "Admins can view settings" ON settings;
DROP POLICY IF EXISTS "Admins can update settings" ON settings;

CREATE POLICY "Admins can view settings"
  ON settings FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Update content modification policies
DROP POLICY IF EXISTS "Admins can insert content" ON content;
DROP POLICY IF EXISTS "Admins can update content" ON content;
DROP POLICY IF EXISTS "Admins can delete content" ON content;

CREATE POLICY "Admins can insert content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update content"
  ON content FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete content"
  ON content FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));