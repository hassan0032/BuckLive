/*
  # Fix User Profiles RLS Policies - Remove Circular Dependencies

  ## Problem
  The user_profiles policies were querying user_profiles table within the policies themselves,
  creating circular dependencies that prevent proper authentication and role checks.

  ## Solution
  Replace nested user_profiles queries with helper functions that use SECURITY DEFINER
  to bypass RLS when checking the current user's own role.

  ## Policies Fixed
  - Admins can delete any profile
  - Admins can update any profile
  - Admins can view all profiles
  - Community managers policies
  - Organization managers policies
  - Users can view/update own profile

  ## Security
  Using helper functions is safe because they only access the current user's data.
*/

-- Admin policies - use is_admin() helper instead of querying user_profiles
DROP POLICY IF EXISTS "Admins can delete any profile" ON user_profiles;
CREATE POLICY "Admins can delete any profile"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_admin());

-- Community manager policies - simplified to avoid circular lookups
DROP POLICY IF EXISTS "Community managers can create community members" ON user_profiles;
CREATE POLICY "Community managers can create community members"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    is_community_manager() AND
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = current_user_id()
      AND cm.community_id = user_profiles.community_id
    )
  );

DROP POLICY IF EXISTS "Community managers can delete community members" ON user_profiles;
CREATE POLICY "Community managers can delete community members"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    is_community_manager() AND
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = current_user_id()
      AND cm.community_id = user_profiles.community_id
    )
  );

DROP POLICY IF EXISTS "Community managers can update community members" ON user_profiles;
CREATE POLICY "Community managers can update community members"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    is_community_manager() AND
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = current_user_id()
      AND cm.community_id = user_profiles.community_id
    )
  )
  WITH CHECK (
    is_community_manager() AND
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = current_user_id()
      AND cm.community_id = user_profiles.community_id
    )
  );

DROP POLICY IF EXISTS "Community managers can view community members" ON user_profiles;
CREATE POLICY "Community managers can view community members"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    is_community_manager() AND
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = current_user_id()
      AND cm.community_id = user_profiles.community_id
    )
  );

-- Organization manager policies - simplified
DROP POLICY IF EXISTS "Org Managers can view user profiles in their org" ON user_profiles;
CREATE POLICY "Org Managers can view user profiles in their org"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    is_organization_manager() AND
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.organization_id = om.organization_id
      WHERE om.user_id = current_user_id()
      AND c.id = user_profiles.community_id
    )
  );

-- User own profile policies - use current_user_id() helper
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = current_user_id());

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = current_user_id())
  WITH CHECK (id = current_user_id());

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = current_user_id());

-- Shared account policy
DROP POLICY IF EXISTS "Shared accounts cannot update their own profile" ON user_profiles;
CREATE POLICY "Shared accounts cannot update their own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = current_user_id() AND is_shared_account = false)
  WITH CHECK (id = current_user_id() AND is_shared_account = false);
