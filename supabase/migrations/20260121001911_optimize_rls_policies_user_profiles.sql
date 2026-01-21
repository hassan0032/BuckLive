/*
  # Optimize RLS Policies for User Profiles Table

  ## Changes
  This migration optimizes RLS policies on the `user_profiles` table by wrapping auth function calls
  with SELECT to prevent re-evaluation on each row.

  ## Policies Updated
  - Admins can delete any profile
  - Admins can update any profile
  - Admins can view all profiles
  - Community managers can create community members
  - Community managers can delete community members
  - Community managers can update community members
  - Community managers can view community members
  - Org Managers can view user profiles in their org
  - Shared accounts cannot update their own profile
  - Users can insert own profile
  - Users can update own profile
  - Users can view own profile

  ## Performance Impact
  Prevents auth functions from being called for every row, improving query performance.
*/

-- Admin policies
DROP POLICY IF EXISTS "Admins can delete any profile" ON user_profiles;
CREATE POLICY "Admins can delete any profile"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
      AND up.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
      AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
      AND up.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
      AND up.role = 'admin'
    )
  );

-- Community manager policies
DROP POLICY IF EXISTS "Community managers can create community members" ON user_profiles;
CREATE POLICY "Community managers can create community members"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE cm.user_id = up.id
      AND cm.community_id = user_profiles.community_id
      AND up.role = 'community_manager'
    )
  );

DROP POLICY IF EXISTS "Community managers can delete community members" ON user_profiles;
CREATE POLICY "Community managers can delete community members"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE cm.user_id = up.id
      AND cm.community_id = user_profiles.community_id
      AND up.role = 'community_manager'
    )
  );

DROP POLICY IF EXISTS "Community managers can update community members" ON user_profiles;
CREATE POLICY "Community managers can update community members"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE cm.user_id = up.id
      AND cm.community_id = user_profiles.community_id
      AND up.role = 'community_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE cm.user_id = up.id
      AND cm.community_id = user_profiles.community_id
      AND up.role = 'community_manager'
    )
  );

DROP POLICY IF EXISTS "Community managers can view community members" ON user_profiles;
CREATE POLICY "Community managers can view community members"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE cm.user_id = up.id
      AND cm.community_id = user_profiles.community_id
      AND up.role = 'community_manager'
    )
  );

-- Organization manager policies
DROP POLICY IF EXISTS "Org Managers can view user profiles in their org" ON user_profiles;
CREATE POLICY "Org Managers can view user profiles in their org"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.organization_id = om.organization_id
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE om.user_id = up.id
      AND c.id = user_profiles.community_id
      AND up.role = 'organization_manager'
    )
  );

-- User self-management policies
DROP POLICY IF EXISTS "Shared accounts cannot update their own profile" ON user_profiles;
CREATE POLICY "Shared accounts cannot update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    user_profiles.id = (SELECT auth.uid())
    AND user_profiles.is_shared_account = false
  )
  WITH CHECK (
    user_profiles.id = (SELECT auth.uid())
    AND user_profiles.is_shared_account = false
  );

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));