/*
  # Optimize RLS Policies for Content, Payments, and Settings Tables

  ## Changes
  This migration optimizes RLS policies on multiple tables by wrapping auth function calls
  with SELECT to prevent re-evaluation on each row.

  ## Tables Updated
  - content
  - payments
  - settings

  ## Performance Impact
  Prevents auth functions from being called for every row, improving query performance.
*/

-- ============================================================
-- CONTENT TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can delete content" ON content;
CREATE POLICY "Admins can delete content"
  ON content FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert content" ON content;
CREATE POLICY "Admins can insert content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update content" ON content;
CREATE POLICY "Admins can update content"
  ON content FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can view all content" ON content;
CREATE POLICY "Admins can view all content"
  ON content FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Gold content restricted to Gold members and Admins" ON content;
CREATE POLICY "Gold content restricted to Gold members and Admins"
  ON content FOR SELECT
  TO authenticated
  USING (
    content.required_tier = 'gold'
    AND content.status = 'published'
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN communities c ON c.id = up.community_id
        WHERE up.id = (SELECT auth.uid())
        AND (
          c.membership_tier = 'gold'
          OR up.role = 'admin'
          OR up.role = 'organization_manager'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can view content based on role and tier" ON content;
CREATE POLICY "Users can view content based on role and tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    content.status = 'published'
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN communities c ON c.id = up.community_id
        WHERE up.id = (SELECT auth.uid())
        AND (
          up.role IN ('admin', 'community_manager', 'organization_manager')
          OR (content.required_tier = 'silver' AND c.membership_tier IN ('silver', 'gold'))
          OR (content.required_tier = 'gold' AND c.membership_tier = 'gold')
        )
      )
    )
  );

-- ============================================================
-- PAYMENTS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- SETTINGS TABLE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can update settings" ON settings;
CREATE POLICY "Admins can update settings"
  ON settings FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can view settings" ON settings;
CREATE POLICY "Admins can view settings"
  ON settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role = 'admin'
    )
  );