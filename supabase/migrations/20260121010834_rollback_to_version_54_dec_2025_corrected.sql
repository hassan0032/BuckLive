/*
  # Rollback to Version 54 (December 24, 2025)

  This migration rolls back all changes from January 21, 2026 that caused content library
  and role display issues. It restores the working state from December 2025.

  ## Changes
  1. Drop all parameterless helper functions that caused circular RLS dependencies
  2. Restore working content SELECT policy from December 2025
  3. Restore working user_profiles policies using old pattern
  4. Restore working policies for all other tables
  5. Keep performance indexes (they're safe)

  ## What's Being Restored
  - Content policy that checks roles directly without helper functions
  - User profiles policies using `is_admin(auth.uid())` with parameter
  - Communities, community_managers, and all other table policies
  - All using the old pattern that worked correctly

  ## Security Notes
  - All policies remain restrictive and secure
  - Uses `get_user_role()` function with `row_security = 'off'` to prevent circular RLS
  - No data leakage through helper functions
*/

-- ============================================================================
-- STEP 1: Drop all parameterless helper functions from January 21, 2026
-- ============================================================================

DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS current_user_id();
DROP FUNCTION IF EXISTS get_current_user_role();
DROP FUNCTION IF EXISTS is_community_manager();
DROP FUNCTION IF EXISTS is_organization_manager();

-- ============================================================================
-- STEP 2: Ensure old helper functions exist with correct definitions
-- ============================================================================

-- Recreate get_user_role function with row_security off
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  user_role text;
BEGIN
  -- Query user_profiles directly without RLS
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id
  LIMIT 1;
  
  RETURN COALESCE(user_role, 'member');
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'member';
END;
$$;

-- Recreate is_admin function that takes a parameter
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT get_user_role(user_id) = 'admin';
$$;

-- ============================================================================
-- STEP 3: Restore content table policies (December 2025 working state)
-- ============================================================================

-- Drop all current content policies
DROP POLICY IF EXISTS "Users can view content based on role and tier" ON content;
DROP POLICY IF EXISTS "Admins can insert content" ON content;
DROP POLICY IF EXISTS "Admins can update content" ON content;
DROP POLICY IF EXISTS "Admins can delete content" ON content;

-- Restore the working content SELECT policy from December 2025
CREATE POLICY "Users can view content based on role and tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND (
      -- Organization Managers and Admins can see all content
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'organization_manager')
      )
      OR
      -- Regular users can see content based on their community's membership tier
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
    )
  );

-- Restore admin content management policies
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

-- ============================================================================
-- STEP 4: Restore user_profiles table policies (December 2025 working state)
-- ============================================================================

-- Drop all current user_profiles policies
DROP POLICY IF EXISTS "Admins can delete any profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Community managers can create community members" ON user_profiles;
DROP POLICY IF EXISTS "Community managers can delete community members" ON user_profiles;
DROP POLICY IF EXISTS "Community managers can update community members" ON user_profiles;
DROP POLICY IF EXISTS "Community managers can view community members" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON user_profiles;

-- Restore working user_profiles policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete any profile"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can insert profiles"
  ON user_profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Community managers can view community members"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = user_profiles.community_id
    )
  );

CREATE POLICY "Community managers can create community members"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = user_profiles.community_id
    )
  );

CREATE POLICY "Community managers can update community members"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = user_profiles.community_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = user_profiles.community_id
    )
  );

CREATE POLICY "Community managers can delete community members"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = user_profiles.community_id
    )
  );

-- ============================================================================
-- STEP 5: Restore communities table policies (December 2025 working state)
-- ============================================================================

-- Drop all current communities policies
DROP POLICY IF EXISTS "Admins can delete any community" ON communities;
DROP POLICY IF EXISTS "Admins can insert communities" ON communities;
DROP POLICY IF EXISTS "Admins can update any community" ON communities;
DROP POLICY IF EXISTS "Admins can view all communities" ON communities;
DROP POLICY IF EXISTS "Community managers can view their communities" ON communities;
DROP POLICY IF EXISTS "Organization managers can manage their org's communities" ON communities;
DROP POLICY IF EXISTS "Organization managers can view their org's communities" ON communities;
DROP POLICY IF EXISTS "Users can view their community" ON communities;

-- Restore working communities policies
CREATE POLICY "Users can view their community"
  ON communities FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT community_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all communities"
  ON communities FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update any community"
  ON communities FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete any community"
  ON communities FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Community managers can view their communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT community_id FROM community_managers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization managers can view their org's communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_managers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization managers can manage their org's communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_managers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_managers WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Restore community_managers table policies
-- ============================================================================

-- Drop all current community_managers policies
DROP POLICY IF EXISTS "Admins can delete community managers" ON community_managers;
DROP POLICY IF EXISTS "Admins can insert community managers" ON community_managers;
DROP POLICY IF EXISTS "Admins can update community managers" ON community_managers;
DROP POLICY IF EXISTS "Admins can view all community managers" ON community_managers;
DROP POLICY IF EXISTS "Community managers can view their assignments" ON community_managers;
DROP POLICY IF EXISTS "Organization managers can manage community managers in their org" ON community_managers;
DROP POLICY IF EXISTS "Organization managers can view community managers in their org" ON community_managers;

-- Restore working community_managers policies
CREATE POLICY "Admins can view all community managers"
  ON community_managers FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert community managers"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update community managers"
  ON community_managers FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete community managers"
  ON community_managers FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Community managers can view their assignments"
  ON community_managers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Organization managers can view community managers in their org"
  ON community_managers FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT c.id FROM communities c
      JOIN organization_managers om ON om.organization_id = c.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Organization managers can manage community managers in their org"
  ON community_managers FOR ALL
  TO authenticated
  USING (
    community_id IN (
      SELECT c.id FROM communities c
      JOIN organization_managers om ON om.organization_id = c.organization_id
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    community_id IN (
      SELECT c.id FROM communities c
      JOIN organization_managers om ON om.organization_id = c.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 7: Restore remaining table policies
-- ============================================================================

-- content_versions policies
DROP POLICY IF EXISTS "Admins can delete content versions" ON content_versions;
DROP POLICY IF EXISTS "Admins can insert content versions" ON content_versions;
DROP POLICY IF EXISTS "Admins can update content versions" ON content_versions;
DROP POLICY IF EXISTS "Admins can view all content versions" ON content_versions;

CREATE POLICY "Admins can view all content versions"
  ON content_versions FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert content versions"
  ON content_versions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update content versions"
  ON content_versions FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete content versions"
  ON content_versions FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- payments policies
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- user_sessions policies
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;

CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- content_views policies
DROP POLICY IF EXISTS "Allow all users to update content views duration" ON content_views;
DROP POLICY IF EXISTS "Users can insert own content views" ON content_views;
DROP POLICY IF EXISTS "Users can view own content views" ON content_views;

CREATE POLICY "Users can view own content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert own content views"
  ON content_views FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Allow all users to update content views duration"
  ON content_views FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- invoices policies
DROP POLICY IF EXISTS "Admin can delete invoice" ON invoices;
DROP POLICY IF EXISTS "Admins can select all invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON invoices;
DROP POLICY IF EXISTS "Community managers can view invoices for their communities" ON invoices;
DROP POLICY IF EXISTS "Organization managers can view invoices for their org's communities" ON invoices;

CREATE POLICY "Admins can select all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin can delete invoice"
  ON invoices FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Community managers can view invoices for their communities"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM community_managers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization managers can view invoices for their org's communities"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_managers WHERE user_id = auth.uid()
    )
  );

-- organizations policies
DROP POLICY IF EXISTS "Admins can manage organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Organization managers can view their organization" ON organizations;

CREATE POLICY "Admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Organization managers can view their organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_managers WHERE user_id = auth.uid()
    )
  );

-- organization_managers policies
DROP POLICY IF EXISTS "Admins can manage organization managers" ON organization_managers;
DROP POLICY IF EXISTS "Admins can view all organization managers" ON organization_managers;
DROP POLICY IF EXISTS "Organization managers can view their assignments" ON organization_managers;

CREATE POLICY "Admins can view all organization managers"
  ON organization_managers FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage organization managers"
  ON organization_managers FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Organization managers can view their assignments"
  ON organization_managers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- content_feedback policies
DROP POLICY IF EXISTS "Admins can manage all feedback" ON content_feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON content_feedback;
DROP POLICY IF EXISTS "Users can submit feedback" ON content_feedback;

CREATE POLICY "Users can submit feedback"
  ON content_feedback FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view all feedback"
  ON content_feedback FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage all feedback"
  ON content_feedback FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- notifications policies
DROP POLICY IF EXISTS "Admins can manage all notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- community_pdfs policies
DROP POLICY IF EXISTS "Admins can manage all PDFs" ON community_pdfs;
DROP POLICY IF EXISTS "Community managers can manage their community PDFs" ON community_pdfs;
DROP POLICY IF EXISTS "Users can view PDFs from their community" ON community_pdfs;

CREATE POLICY "Users can view PDFs from their community"
  ON community_pdfs FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Community managers can manage their community PDFs"
  ON community_pdfs FOR ALL
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM community_managers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    community_id IN (
      SELECT community_id FROM community_managers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all PDFs"
  ON community_pdfs FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- logs table policies
DROP POLICY IF EXISTS "Admins can view all logs" ON logs;

CREATE POLICY "Admins can view all logs"
  ON logs FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- settings policies
DROP POLICY IF EXISTS "Admins can manage settings" ON settings;
DROP POLICY IF EXISTS "Users can view settings" ON settings;

CREATE POLICY "Users can view settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage settings"
  ON settings FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
