/*
  # Optimize RLS Policies for Communities Table

  ## Changes
  This migration optimizes RLS policies on the `communities` table by wrapping auth function calls
  with SELECT to prevent re-evaluation on each row, significantly improving query performance.

  ## Policies Updated
  - Admins can delete communities
  - Admins can insert communities
  - Admins can update communities
  - Community managers can create communities
  - Community managers can delete managed communities
  - Community managers can update managed communities
  - Community managers can view managed communities
  - Org Managers can insert communities into their org
  - Org Managers can update communities in their org
  - Org Managers can view communities in their org

  ## Performance Impact
  These changes prevent auth functions from being called for every row, dramatically improving
  query performance at scale.
*/

-- Drop and recreate admin policies for communities
DROP POLICY IF EXISTS "Admins can delete communities" ON communities;
CREATE POLICY "Admins can delete communities"
  ON communities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert communities" ON communities;
CREATE POLICY "Admins can insert communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update communities" ON communities;
CREATE POLICY "Admins can update communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- Drop and recreate community manager policies
DROP POLICY IF EXISTS "Community managers can create communities" ON communities;
CREATE POLICY "Community managers can create communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'community_manager'
    )
  );

DROP POLICY IF EXISTS "Community managers can delete managed communities" ON communities;
CREATE POLICY "Community managers can delete managed communities"
  ON communities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers
      WHERE community_managers.user_id = (SELECT auth.uid())
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
      WHERE community_managers.user_id = (SELECT auth.uid())
      AND community_managers.community_id = communities.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_managers
      WHERE community_managers.user_id = (SELECT auth.uid())
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
      WHERE community_managers.user_id = (SELECT auth.uid())
      AND community_managers.community_id = communities.id
    )
  );

-- Drop and recreate organization manager policies
DROP POLICY IF EXISTS "Org Managers can insert communities into their org" ON communities;
CREATE POLICY "Org Managers can insert communities into their org"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE om.user_id = up.id
      AND om.organization_id = communities.organization_id
      AND up.role = 'organization_manager'
    )
  );

DROP POLICY IF EXISTS "Org Managers can update communities in their org" ON communities;
CREATE POLICY "Org Managers can update communities in their org"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE om.user_id = up.id
      AND om.organization_id = communities.organization_id
      AND up.role = 'organization_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE om.user_id = up.id
      AND om.organization_id = communities.organization_id
      AND up.role = 'organization_manager'
    )
  );

DROP POLICY IF EXISTS "Org Managers can view communities in their org" ON communities;
CREATE POLICY "Org Managers can view communities in their org"
  ON communities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE om.user_id = up.id
      AND om.organization_id = communities.organization_id
      AND up.role = 'organization_manager'
    )
  );