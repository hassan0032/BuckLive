/*
  # Fix Remaining Tables RLS Policies - Remove Circular Dependencies

  ## Problem
  Multiple tables had policies querying user_profiles, causing circular dependencies.

  ## Solution
  Use helper functions for all remaining tables to eliminate circular dependencies.

  ## Tables Fixed
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
  - payments
  - settings

  ## Security
  Maintains same security model while improving performance and eliminating circular lookups.
*/

-- ============================================================
-- CONTENT VERSIONS
-- ============================================================

DROP POLICY IF EXISTS "Admins can insert versions" ON content_versions;
CREATE POLICY "Admins can insert versions"
  ON content_versions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can view all versions" ON content_versions;
CREATE POLICY "Admins can view all versions"
  ON content_versions FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================================
-- COMMUNITY MANAGERS
-- ============================================================

DROP POLICY IF EXISTS "Admins can create manager assignments" ON community_managers;
CREATE POLICY "Admins can create manager assignments"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete manager assignments" ON community_managers;
CREATE POLICY "Admins can delete manager assignments"
  ON community_managers FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can view all manager assignments" ON community_managers;
CREATE POLICY "Admins can view all manager assignments"
  ON community_managers FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Community managers can create own assignments" ON community_managers;
CREATE POLICY "Community managers can create own assignments"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    is_community_manager() AND
    user_id = current_user_id()
  );

DROP POLICY IF EXISTS "Org Managers can assign community managers in their org" ON community_managers;
CREATE POLICY "Org Managers can assign community managers in their org"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    is_organization_manager() AND
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.organization_id = om.organization_id
      WHERE om.user_id = current_user_id()
      AND c.id = community_managers.community_id
    )
  );

DROP POLICY IF EXISTS "Org Managers can remove community managers in their org" ON community_managers;
CREATE POLICY "Org Managers can remove community managers in their org"
  ON community_managers FOR DELETE
  TO authenticated
  USING (
    is_organization_manager() AND
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.organization_id = om.organization_id
      WHERE om.user_id = current_user_id()
      AND c.id = community_managers.community_id
    )
  );

DROP POLICY IF EXISTS "Org Managers can view community managers in their org" ON community_managers;
CREATE POLICY "Org Managers can view community managers in their org"
  ON community_managers FOR SELECT
  TO authenticated
  USING (
    is_organization_manager() AND
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.organization_id = om.organization_id
      WHERE om.user_id = current_user_id()
      AND c.id = community_managers.community_id
    )
  );

DROP POLICY IF EXISTS "Users can view own manager assignments" ON community_managers;
CREATE POLICY "Users can view own manager assignments"
  ON community_managers FOR SELECT
  TO authenticated
  USING (user_id = current_user_id());

-- ============================================================
-- CONTENT VIEWS
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all content views" ON content_views;
CREATE POLICY "Admins can view all content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Community managers can view community content views" ON content_views;
CREATE POLICY "Community managers can view community content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (
    is_community_manager() AND
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = user_id
      WHERE cm.user_id = current_user_id()
      AND cm.community_id = up.community_id
    )
  );

DROP POLICY IF EXISTS "Users can view own content views" ON content_views;
CREATE POLICY "Users can view own content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (user_id = current_user_id());

-- ============================================================
-- USER SESSIONS
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all sessions" ON user_sessions;
CREATE POLICY "Admins can view all sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Community managers can view community sessions" ON user_sessions;
CREATE POLICY "Community managers can view community sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    is_community_manager() AND
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = user_id
      WHERE cm.user_id = current_user_id()
      AND cm.community_id = up.community_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;
CREATE POLICY "Users can insert own sessions"
  ON user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = current_user_id());

DROP POLICY IF EXISTS "Users can update own sessions" ON user_sessions;
CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = current_user_id());

-- ============================================================
-- INVOICES
-- ============================================================

DROP POLICY IF EXISTS "Admins can update invoices" ON invoices;
CREATE POLICY "Admins can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Allow admin to delete invoices" ON invoices;
CREATE POLICY "Allow admin to delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Community Managers can view managed community invoices" ON invoices;
CREATE POLICY "Community Managers can view managed community invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = current_user_id()
      AND cm.community_id = invoices.community_id
    )
  );

DROP POLICY IF EXISTS "Org Admins can view all invoices" ON invoices;
CREATE POLICY "Org Admins can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Org Managers can view invoices in their org" ON invoices;
CREATE POLICY "Org Managers can view invoices in their org"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    is_organization_manager() AND
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = current_user_id()
      AND om.organization_id = invoices.organization_id
    )
  );

-- ============================================================
-- CONTENT FEEDBACK
-- ============================================================

DROP POLICY IF EXISTS "Admins can delete feedback" ON content_feedback;
CREATE POLICY "Admins can delete feedback"
  ON content_feedback FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can update feedback" ON content_feedback;
CREATE POLICY "Admins can update feedback"
  ON content_feedback FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can view all feedback" ON content_feedback;
CREATE POLICY "Admins can view all feedback"
  ON content_feedback FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================================
-- COMMUNITY PDFS
-- ============================================================

DROP POLICY IF EXISTS "Admins and Managers can view community pdfs" ON community_pdfs;
CREATE POLICY "Admins and Managers can view community pdfs"
  ON community_pdfs FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    is_organization_manager() OR
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = current_user_id()
      AND cm.community_id = community_pdfs.community_id
    )
  );

DROP POLICY IF EXISTS "Admins can delete community pdfs" ON community_pdfs;
CREATE POLICY "Admins can delete community pdfs"
  ON community_pdfs FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert community pdfs" ON community_pdfs;
CREATE POLICY "Admins can insert community pdfs"
  ON community_pdfs FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;
CREATE POLICY "Admins can delete notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;
CREATE POLICY "Admins can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update all notifications" ON notifications;
CREATE POLICY "Admins can update all notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;
CREATE POLICY "Admins can view all notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Users can update own read status" ON notifications;
CREATE POLICY "Users can update own read status"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = current_user_id());

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

DROP POLICY IF EXISTS "Admins can do everything on organizations" ON organizations;
CREATE POLICY "Admins can do everything on organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Org Managers can view their own organization" ON organizations;
CREATE POLICY "Org Managers can view their own organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    is_organization_manager() AND
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = current_user_id()
      AND om.organization_id = organizations.id
    )
  );

-- ============================================================
-- ORGANIZATION MANAGERS
-- ============================================================

DROP POLICY IF EXISTS "Admins can do everything on organization_managers" ON organization_managers;
CREATE POLICY "Admins can do everything on organization_managers"
  ON organization_managers FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Org Managers can view their own assignment" ON organization_managers;
CREATE POLICY "Org Managers can view their own assignment"
  ON organization_managers FOR SELECT
  TO authenticated
  USING (user_id = current_user_id());

-- ============================================================
-- LOGS
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all tier logs" ON logs;
CREATE POLICY "Admins can view all tier logs"
  ON logs FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================================
-- PAYMENTS (if exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
    EXECUTE 'CREATE POLICY "Admins can view all payments" ON payments FOR SELECT TO authenticated USING (is_admin())';
  END IF;
END $$;

-- ============================================================
-- SETTINGS (if exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings') THEN
    DROP POLICY IF EXISTS "Admins can update settings" ON settings;
    EXECUTE 'CREATE POLICY "Admins can update settings" ON settings FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin())';
    
    DROP POLICY IF EXISTS "Admins can view all settings" ON settings;
    EXECUTE 'CREATE POLICY "Admins can view all settings" ON settings FOR SELECT TO authenticated USING (is_admin())';
  END IF;
END $$;
