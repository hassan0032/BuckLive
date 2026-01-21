/*
  # True Rollback - Remove ALL Helper Function Usage

  ## Problem
  The previous rollback still used helper functions in the restored policies.
  Helper functions still exist and are causing circular RLS dependencies.

  ## Solution
  1. Drop ALL policies on all tables
  2. Drop ALL helper functions
  3. Restore policies to December 2025 state using ONLY auth.uid() and EXISTS clauses
     WITHOUT any helper functions

  ## Changes
  Complete removal of helper function architecture and restoration of direct
  auth.uid() based policies from December 2025.
*/

-- ============================================================================
-- Step 1: Drop ALL policies that might reference helper functions
-- ============================================================================

-- Content table
DROP POLICY IF EXISTS "Admins can delete content" ON content;
DROP POLICY IF EXISTS "Admins can insert content" ON content;
DROP POLICY IF EXISTS "Admins can update content" ON content;
DROP POLICY IF EXISTS "Admins can view all content" ON content;
DROP POLICY IF EXISTS "Gold content restricted to Gold members and Admins" ON content;
DROP POLICY IF EXISTS "Users can view content based on role and tier" ON content;
DROP POLICY IF EXISTS "Users can view silver content" ON content;

-- User profiles table
DROP POLICY IF EXISTS "Admins can delete any profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Community managers can create community members" ON user_profiles;
DROP POLICY IF EXISTS "Community managers can delete community members" ON user_profiles;
DROP POLICY IF EXISTS "Community managers can update community members" ON user_profiles;
DROP POLICY IF EXISTS "Community managers can view community members" ON user_profiles;
DROP POLICY IF EXISTS "Org Managers can view user profiles in their org" ON user_profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Shared accounts cannot update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

-- Communities table
DROP POLICY IF EXISTS "Admins can delete communities" ON communities;
DROP POLICY IF EXISTS "Admins can insert communities" ON communities;
DROP POLICY IF EXISTS "Admins can update communities" ON communities;
DROP POLICY IF EXISTS "Admins can view all communities" ON communities;
DROP POLICY IF EXISTS "Community managers can view managed communities" ON communities;
DROP POLICY IF EXISTS "Community managers can update managed communities" ON communities;
DROP POLICY IF EXISTS "Community managers can delete managed communities" ON communities;
DROP POLICY IF EXISTS "Org Managers can view communities in their org" ON communities;
DROP POLICY IF EXISTS "Org Managers can insert communities into their org" ON communities;
DROP POLICY IF EXISTS "Org Managers can update communities in their org" ON communities;
DROP POLICY IF EXISTS "Users can view own community" ON communities;
DROP POLICY IF EXISTS "Anon can view communities for validation" ON communities;
DROP POLICY IF EXISTS "Authenticated users can view communities" ON communities;
DROP POLICY IF EXISTS "Community managers can create communities" ON communities;

-- Community managers table
DROP POLICY IF EXISTS "Admins can delete community managers" ON community_managers;
DROP POLICY IF EXISTS "Admins can insert community managers" ON community_managers;
DROP POLICY IF EXISTS "Admins can update community managers" ON community_managers;
DROP POLICY IF EXISTS "Admins can view all community managers" ON community_managers;
DROP POLICY IF EXISTS "Community managers can create own assignments" ON community_managers;
DROP POLICY IF EXISTS "Users can view own manager assignments" ON community_managers;
DROP POLICY IF EXISTS "Org Managers can view community managers in their org" ON community_managers;
DROP POLICY IF EXISTS "Org Managers can assign community managers in their org" ON community_managers;
DROP POLICY IF EXISTS "Org Managers can remove community managers in their org" ON community_managers;

-- Other tables
DROP POLICY IF EXISTS "Admins can view all content views" ON content_views;
DROP POLICY IF EXISTS "Users can view own content views" ON content_views;
DROP POLICY IF EXISTS "Users can insert own content views" ON content_views;
DROP POLICY IF EXISTS "All users can update content views duration" ON content_views;
DROP POLICY IF EXISTS "Community managers can view community content views" ON content_views;

DROP POLICY IF EXISTS "Admins can view all sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Community managers can view community sessions" ON user_sessions;

DROP POLICY IF EXISTS "Admins can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Community Managers can view managed community invoices" ON invoices;
DROP POLICY IF EXISTS "Org Managers can view invoices in their org" ON invoices;

DROP POLICY IF EXISTS "Admins and Managers can view community pdfs" ON community_pdfs;
DROP POLICY IF EXISTS "Admins and Managers can insert community pdfs" ON community_pdfs;
DROP POLICY IF EXISTS "Admins and Managers can delete community pdfs" ON community_pdfs;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own read status" ON notifications;

DROP POLICY IF EXISTS "Admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Org Managers can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Admins can manage organizations" ON organizations;

DROP POLICY IF EXISTS "Admins can view all organization managers" ON organization_managers;
DROP POLICY IF EXISTS "Org Managers can view their own assignment" ON organization_managers;
DROP POLICY IF EXISTS "Admins can manage organization managers" ON organization_managers;

-- ============================================================================
-- Step 2: Drop ALL helper functions  
-- ============================================================================

DROP FUNCTION IF EXISTS current_user_id() CASCADE;
DROP FUNCTION IF EXISTS current_user_role() CASCADE;
DROP FUNCTION IF EXISTS current_user_community_id() CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_community_manager() CASCADE;
DROP FUNCTION IF EXISTS is_organization_manager() CASCADE;

-- ============================================================================
-- Step 3: Restore policies WITHOUT helper functions - December 2025 state
-- ============================================================================

-- CONTENT POLICIES
CREATE POLICY "Users can view content based on role and tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    status = 'published' AND (
      -- Admins, Organization Managers, and Community Managers can see all content
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'organization_manager', 'community_manager')
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

CREATE POLICY "Admins can insert content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update content"
  ON content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete content"
  ON content FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- USER_PROFILES POLICIES
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND is_shared_account = false)
  WITH CHECK (id = auth.uid() AND is_shared_account = false);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  );

CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete any profile"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  );

CREATE POLICY "Community managers can view community members"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE cm.user_id = up.id
      AND cm.community_id = user_profiles.community_id
      AND up.role = 'community_manager'
    )
  );

CREATE POLICY "Community managers can create community members"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE cm.user_id = up.id
      AND cm.community_id = user_profiles.community_id
      AND up.role = 'community_manager'
    )
  );

CREATE POLICY "Community managers can update community members"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE cm.user_id = up.id
      AND cm.community_id = user_profiles.community_id
      AND up.role = 'community_manager'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE cm.user_id = up.id
      AND cm.community_id = user_profiles.community_id
      AND up.role = 'community_manager'
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

CREATE POLICY "Org Managers can view user profiles in their org"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.organization_id = om.organization_id
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE om.user_id = up.id
      AND c.id = user_profiles.community_id
      AND up.role = 'organization_manager'
    )
  );

CREATE POLICY "Service role can insert profiles"
  ON user_profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- COMMUNITIES POLICIES
CREATE POLICY "Admins can view all communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete communities"
  ON communities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Community managers can view managed communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = communities.id
    )
  );

CREATE POLICY "Community managers can update managed communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = communities.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = communities.id
    )
  );

CREATE POLICY "Community managers can delete managed communities"
  ON communities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = communities.id
    )
  );

CREATE POLICY "Org Managers can view communities in their org"
  ON communities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = communities.organization_id
    )
  );

CREATE POLICY "Org Managers can insert communities into their org"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = communities.organization_id
    )
  );

CREATE POLICY "Org Managers can update communities in their org"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = communities.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = communities.organization_id
    )
  );

CREATE POLICY "Users can view own community"
  ON communities FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT community_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Anon can view communities for validation"
  ON communities FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can view communities"
  ON communities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Community managers can create communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'community_manager'
    )
  );

-- Continue with remaining tables...
-- COMMUNITY_MANAGERS policies
CREATE POLICY "Admins can view all community managers"
  ON community_managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert community managers"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update community managers"
  ON community_managers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete community managers"
  ON community_managers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own manager assignments"
  ON community_managers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Community managers can create own assignments"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Org Managers can view community managers in their org"
  ON community_managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.id = community_managers.community_id
      WHERE om.user_id = auth.uid()
      AND om.organization_id = c.organization_id
    )
  );

CREATE POLICY "Org Managers can assign community managers in their org"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.id = community_managers.community_id
      WHERE om.user_id = auth.uid()
      AND om.organization_id = c.organization_id
    )
  );

CREATE POLICY "Org Managers can remove community managers in their org"
  ON community_managers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      JOIN communities c ON c.id = community_managers.community_id
      WHERE om.user_id = auth.uid()
      AND om.organization_id = c.organization_id
    )
  );

-- CONTENT_VIEWS policies
CREATE POLICY "Admins can view all content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own content views"
  ON content_views FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All users can update content views duration"
  ON content_views FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Community managers can view community content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = content_views.community_id
    )
  );

-- USER_SESSIONS policies
CREATE POLICY "Admins can view all sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
  ON user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Community managers can view community sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      JOIN user_profiles up ON up.community_id = cm.community_id
      WHERE cm.user_id = auth.uid()
      AND up.id = user_sessions.user_id
    )
  );

-- INVOICES policies
CREATE POLICY "Admins can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Community Managers can view managed community invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = invoices.community_id
    )
  );

CREATE POLICY "Org Managers can view invoices in their org"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_managers om
      WHERE om.user_id = auth.uid()
      AND om.organization_id = invoices.organization_id
    )
  );

-- COMMUNITY_PDFS policies
CREATE POLICY "Admins and Managers can view community pdfs"
  ON community_pdfs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'community_manager', 'organization_manager')
    ) OR
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = community_pdfs.community_id
    )
  );

CREATE POLICY "Admins and Managers can insert community pdfs"
  ON community_pdfs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'community_manager', 'organization_manager')
    ) OR
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = community_pdfs.community_id
    )
  );

CREATE POLICY "Admins and Managers can delete community pdfs"
  ON community_pdfs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'community_manager', 'organization_manager')
    ) OR
    EXISTS (
      SELECT 1 FROM community_managers cm
      WHERE cm.user_id = auth.uid()
      AND cm.community_id = community_pdfs.community_id
    )
  );

-- NOTIFICATIONS policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own read status"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ORGANIZATIONS policies
CREATE POLICY "Admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Org Managers can view their own organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_managers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage organizations"
  ON organizations
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ORGANIZATION_MANAGERS policies
CREATE POLICY "Admins can view all organization managers"
  ON organization_managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Org Managers can view their own assignment"
  ON organization_managers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage organization managers"
  ON organization_managers
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
