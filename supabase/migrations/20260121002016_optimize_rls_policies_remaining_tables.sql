/*
  # Optimize RLS Policies for Remaining Tables

  ## Changes
  This migration optimizes RLS policies on remaining tables by wrapping auth function calls
  with SELECT to prevent re-evaluation on each row.

  ## Tables Updated
  - content_versions
  - community_managers
  - content_views
  - user_sessions
  - invoices
  - content_feedback
  - community_pdfs
  - notifications
  - organizations
  - organization_managers
  - logs

  ## Performance Impact
  Prevents auth functions from being called for every row, improving query performance.
*/

-- ============================================================
-- CONTENT_VERSIONS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can insert versions" ON content_versions;
CREATE POLICY "Admins can insert versions"
  ON content_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view all versions" ON content_versions;
CREATE POLICY "Admins can view all versions"
  ON content_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view versions of accessible content" ON content_versions;
CREATE POLICY "Users can view versions of accessible content"
  ON content_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM content c
      WHERE c.id = content_versions.content_id
      AND (
        EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN communities comm ON comm.id = up.community_id
          WHERE up.id = (SELECT auth.uid())
          AND (
            up.role IN ('admin', 'community_manager', 'organization_manager')
            OR (c.required_tier = 'silver' AND comm.membership_tier IN ('silver', 'gold'))
            OR (c.required_tier = 'gold' AND comm.membership_tier = 'gold')
          )
        )
      )
    )
  );

-- ============================================================
-- COMMUNITY_MANAGERS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can create manager assignments" ON community_managers;
CREATE POLICY "Admins can create manager assignments"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete manager assignments" ON community_managers;
CREATE POLICY "Admins can delete manager assignments"
  ON community_managers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can view all manager assignments" ON community_managers;
CREATE POLICY "Admins can view all manager assignments"
  ON community_managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community managers can create own assignments" ON community_managers;
CREATE POLICY "Community managers can create own assignments"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'community_manager'
    )
  );

DROP POLICY IF EXISTS "Org Managers can assign community managers in their org" ON community_managers;
CREATE POLICY "Org Managers can assign community managers in their org"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.organization_id = om.organization_id
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE om.user_id = up.id
      AND c.id = community_managers.community_id
      AND up.role = 'organization_manager'
    )
  );

DROP POLICY IF EXISTS "Org Managers can remove community managers in their org" ON community_managers;
CREATE POLICY "Org Managers can remove community managers in their org"
  ON community_managers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.organization_id = om.organization_id
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE om.user_id = up.id
      AND c.id = community_managers.community_id
      AND up.role = 'organization_manager'
    )
  );

DROP POLICY IF EXISTS "Org Managers can view community managers in their org" ON community_managers;
CREATE POLICY "Org Managers can view community managers in their org"
  ON community_managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.organization_id = om.organization_id
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE om.user_id = up.id
      AND c.id = community_managers.community_id
      AND up.role = 'organization_manager'
    )
  );

DROP POLICY IF EXISTS "Users can view own manager assignments" ON community_managers;
CREATE POLICY "Users can view own manager assignments"
  ON community_managers FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- CONTENT_VIEWS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all content views" ON content_views;
CREATE POLICY "Admins can view all content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community managers can view community content views" ON content_views;
CREATE POLICY "Community managers can view community content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = (SELECT auth.uid())
      AND cm.community_id = content_views.community_id
    )
  );

DROP POLICY IF EXISTS "Users can view own content views" ON content_views;
CREATE POLICY "Users can view own content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- USER_SESSIONS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all sessions" ON user_sessions;
CREATE POLICY "Admins can view all sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community managers can view community sessions" ON user_sessions;
CREATE POLICY "Community managers can view community sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = user_sessions.user_id
      WHERE cm.user_id = (SELECT auth.uid())
      AND cm.community_id = up.community_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;
CREATE POLICY "Users can insert own sessions"
  ON user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own sessions" ON user_sessions;
CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- INVOICES TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can update invoices" ON invoices;
CREATE POLICY "Admins can update invoices"
  ON invoices FOR UPDATE
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

DROP POLICY IF EXISTS "Allow admin to delete invoices" ON invoices;
CREATE POLICY "Allow admin to delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community Managers can view managed community invoices" ON invoices;
CREATE POLICY "Community Managers can view managed community invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = (SELECT auth.uid())
      AND cm.community_id = invoices.community_id
    )
  );

DROP POLICY IF EXISTS "Org Admins can view all invoices" ON invoices;
CREATE POLICY "Org Admins can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Org Managers can view invoices in their org" ON invoices;
CREATE POLICY "Org Managers can view invoices in their org"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE om.user_id = up.id
      AND om.organization_id = invoices.organization_id
      AND up.role = 'organization_manager'
    )
  );

-- ============================================================
-- CONTENT_FEEDBACK TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can delete feedback" ON content_feedback;
CREATE POLICY "Admins can delete feedback"
  ON content_feedback FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update feedback" ON content_feedback;
CREATE POLICY "Admins can update feedback"
  ON content_feedback FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can view all feedback" ON content_feedback;
CREATE POLICY "Admins can view all feedback"
  ON content_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================
-- COMMUNITY_PDFS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins and Managers can view community pdfs" ON community_pdfs;
CREATE POLICY "Admins and Managers can view community pdfs"
  ON community_pdfs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
      AND (
        up.role = 'admin'
        OR (
          up.role = 'community_manager'
          AND EXISTS (
            SELECT 1 FROM community_managers cm
            WHERE cm.user_id = up.id
            AND cm.community_id = community_pdfs.community_id
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Admins can delete community pdfs" ON community_pdfs;
CREATE POLICY "Admins can delete community pdfs"
  ON community_pdfs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert community pdfs" ON community_pdfs;
CREATE POLICY "Admins can insert community pdfs"
  ON community_pdfs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

-- ============================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;
CREATE POLICY "Admins can delete notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;
CREATE POLICY "Admins can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update all notifications" ON notifications;
CREATE POLICY "Admins can update all notifications"
  ON notifications FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;
CREATE POLICY "Admins can view all notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can update own read status" ON notifications;
CREATE POLICY "Users can update own read status"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can do everything on organizations" ON organizations;
CREATE POLICY "Admins can do everything on organizations"
  ON organizations FOR ALL
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

DROP POLICY IF EXISTS "Org Managers can view their own organization" ON organizations;
CREATE POLICY "Org Managers can view their own organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN user_profiles up ON up.id = (SELECT auth.uid())
      WHERE om.user_id = up.id
      AND om.organization_id = organizations.id
      AND up.role = 'organization_manager'
    )
  );

-- ============================================================
-- ORGANIZATION_MANAGERS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can do everything on organization_managers" ON organization_managers;
CREATE POLICY "Admins can do everything on organization_managers"
  ON organization_managers FOR ALL
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

DROP POLICY IF EXISTS "Org Managers can view their own assignment" ON organization_managers;
CREATE POLICY "Org Managers can view their own assignment"
  ON organization_managers FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- LOGS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all tier logs" ON logs;
CREATE POLICY "Admins can view all tier logs"
  ON logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );