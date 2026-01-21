/*
  # Fix Communities RLS Policies - Remove Circular Dependencies

  ## Problem
  The communities policies were querying user_profiles within the policies,
  which could cause circular dependencies and performance issues.

  ## Solution
  Use helper functions (is_admin, is_community_manager, is_organization_manager)
  that bypass RLS when checking the current user's role.

  ## Policies Fixed
  - Admin policies for communities
  - Community manager policies
  - Organization manager policies

  ## Security
  Helper functions only access the current user's own data, so this is safe.
*/

-- Admin policies
DROP POLICY IF EXISTS "Admins can delete communities" ON communities;
CREATE POLICY "Admins can delete communities"
  ON communities FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert communities" ON communities;
CREATE POLICY "Admins can insert communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update communities" ON communities;
CREATE POLICY "Admins can update communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Community manager policies
DROP POLICY IF EXISTS "Community managers can create communities" ON communities;
CREATE POLICY "Community managers can create communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (is_community_manager());

DROP POLICY IF EXISTS "Community managers can delete managed communities" ON communities;
CREATE POLICY "Community managers can delete managed communities"
  ON communities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers
      WHERE community_managers.user_id = current_user_id()
      AND community_managers.community_id = communities.id
    )
  );

DROP POLICY IF EXISTS "Community managers can update managed communities" ON communities;
CREATE POLICY "Community managers can update managed communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers
      WHERE community_managers.user_id = current_user_id()
      AND community_managers.community_id = communities.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_managers
      WHERE community_managers.user_id = current_user_id()
      AND community_managers.community_id = communities.id
    )
  );

DROP POLICY IF EXISTS "Community managers can view managed communities" ON communities;
CREATE POLICY "Community managers can view managed communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers
      WHERE community_managers.user_id = current_user_id()
      AND community_managers.community_id = communities.id
    )
  );

-- Organization manager policies
DROP POLICY IF EXISTS "Org Managers can insert communities into their org" ON communities;
CREATE POLICY "Org Managers can insert communities into their org"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (
    is_organization_manager() AND
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = current_user_id()
      AND om.organization_id = communities.organization_id
    )
  );

DROP POLICY IF EXISTS "Org Managers can update communities in their org" ON communities;
CREATE POLICY "Org Managers can update communities in their org"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    is_organization_manager() AND
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = current_user_id()
      AND om.organization_id = communities.organization_id
    )
  )
  WITH CHECK (
    is_organization_manager() AND
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = current_user_id()
      AND om.organization_id = communities.organization_id
    )
  );

DROP POLICY IF EXISTS "Org Managers can view communities in their org" ON communities;
CREATE POLICY "Org Managers can view communities in their org"
  ON communities FOR SELECT
  TO authenticated
  USING (
    is_organization_manager() AND
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = current_user_id()
      AND om.organization_id = communities.organization_id
    )
  );
