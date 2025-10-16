/*
  # Add Community Manager Role and Analytics System

  ## Overview
  This migration adds a community manager role that sits between members and admins,
  enabling decentralized community management with comprehensive analytics tracking.

  ## New Tables

  ### 1. community_managers
  Junction table linking community managers to multiple communities.
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, references user_profiles) - The community manager
  - `community_id` (uuid, references communities) - The managed community
  - `created_at` (timestamptz) - When assignment was made
  - `created_by` (uuid, references user_profiles) - Admin who made the assignment

  ### 2. content_views
  Tracks when users view content and for how long.
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, references user_profiles) - User viewing content
  - `content_id` (uuid, references content) - Content being viewed
  - `view_duration` (integer) - Duration in seconds
  - `viewed_at` (timestamptz) - When content was viewed
  - `community_id` (uuid, references communities) - User's community at time of view

  ### 3. user_sessions
  Logs user login sessions for activity tracking.
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, references user_profiles) - User in session
  - `login_at` (timestamptz) - Session start time
  - `logout_at` (timestamptz) - Session end time (nullable)
  - `session_duration` (integer) - Duration in seconds (nullable)

  ## Table Updates

  ### communities table
  - Add `created_by_manager_id` (uuid, references user_profiles) - Community manager who created it

  ### user_profiles table
  - Update role constraint to include 'community_manager'

  ## Security

  ### community_managers table
  - RLS enabled
  - Community managers can view their own assignments
  - Admins can view and manage all assignments
  - Community managers can create assignments when creating communities

  ### content_views table
  - RLS enabled
  - Users can insert their own views
  - Community managers can view all views in their communities
  - Admins can view all views

  ### user_sessions table
  - RLS enabled
  - Users can insert and view their own sessions
  - Community managers can view sessions in their communities
  - Admins can view all sessions

  ## Helper Functions

  - `is_community_manager(user_id, community_id)` - Check if user manages specific community
  - `get_managed_communities(user_id)` - Get all communities managed by user
  - `get_community_members_count(community_id)` - Get member count for community

  ## Indexes

  - community_managers: (user_id, community_id) for fast lookups
  - content_views: (content_id), (user_id), (viewed_at) for analytics queries
  - user_sessions: (user_id), (login_at) for activity tracking
*/

-- ============================================================================
-- STEP 1: Update user_profiles table to support community_manager role
-- ============================================================================

-- Drop existing role constraint and recreate with community_manager
DO $$
BEGIN
  -- Drop the existing constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_profiles_role_check' 
    AND table_name = 'user_profiles'
  ) THEN
    ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
  END IF;

  -- Add new constraint with community_manager
  ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
    CHECK (role IN ('member', 'admin', 'community_manager'));
END $$;

-- ============================================================================
-- STEP 2: Create community_managers junction table
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  UNIQUE(user_id, community_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_community_managers_user_id ON community_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_community_managers_community_id ON community_managers(community_id);
CREATE INDEX IF NOT EXISTS idx_community_managers_user_community ON community_managers(user_id, community_id);

-- ============================================================================
-- STEP 3: Create content_views table for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS content_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  view_duration integer DEFAULT 0,
  viewed_at timestamptz DEFAULT now(),
  community_id uuid REFERENCES communities(id) ON DELETE SET NULL
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_content_views_content_id ON content_views(content_id);
CREATE INDEX IF NOT EXISTS idx_content_views_user_id ON content_views(user_id);
CREATE INDEX IF NOT EXISTS idx_content_views_viewed_at ON content_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_views_community_id ON content_views(community_id);

-- ============================================================================
-- STEP 4: Create user_sessions table for activity tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  login_at timestamptz DEFAULT now(),
  logout_at timestamptz,
  session_duration integer
);

-- Create indexes for activity queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_at ON user_sessions(login_at DESC);

-- ============================================================================
-- STEP 5: Update communities table
-- ============================================================================

-- Add created_by_manager_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'created_by_manager_id'
  ) THEN
    ALTER TABLE communities ADD COLUMN created_by_manager_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_communities_created_by_manager ON communities(created_by_manager_id);

-- ============================================================================
-- STEP 6: Create helper functions
-- ============================================================================

-- Function to check if user is a community manager for specific community
CREATE OR REPLACE FUNCTION public.is_community_manager(user_id uuid, community_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM community_managers cm
    WHERE cm.user_id = is_community_manager.user_id 
    AND cm.community_id = is_community_manager.community_id
  ) OR public.get_user_role(user_id) = 'community_manager';
END;
$$;

-- Function to get all communities managed by a user
CREATE OR REPLACE FUNCTION public.get_managed_communities(user_id uuid)
RETURNS TABLE(community_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  SELECT cm.community_id
  FROM community_managers cm
  WHERE cm.user_id = get_managed_communities.user_id;
END;
$$;

-- Function to get member count for a community
CREATE OR REPLACE FUNCTION public.get_community_members_count(community_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
DECLARE
  member_count integer;
BEGIN
  SELECT COUNT(*) INTO member_count
  FROM user_profiles up
  WHERE up.community_id = get_community_members_count.community_id;
  
  RETURN COALESCE(member_count, 0);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_community_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_managed_communities(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_members_count(uuid) TO authenticated;

-- ============================================================================
-- STEP 7: Enable RLS on new tables
-- ============================================================================

ALTER TABLE community_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: Create RLS policies for community_managers table
-- ============================================================================

-- Users can view their own community manager assignments
CREATE POLICY "Users can view own manager assignments"
  ON community_managers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all assignments
CREATE POLICY "Admins can view all manager assignments"
  ON community_managers FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins can create manager assignments
CREATE POLICY "Admins can create manager assignments"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Community managers can create assignments when creating communities
CREATE POLICY "Community managers can create own assignments"
  ON community_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND public.get_user_role(auth.uid()) = 'community_manager'
  );

-- Admins can delete manager assignments
CREATE POLICY "Admins can delete manager assignments"
  ON community_managers FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- STEP 9: Create RLS policies for content_views table
-- ============================================================================

-- Users can insert their own views
CREATE POLICY "Users can insert own content views"
  ON content_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own content views
CREATE POLICY "Users can view own content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Community managers can view all views in their managed communities
CREATE POLICY "Community managers can view community content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT get_managed_communities(auth.uid())
    )
  );

-- Admins can view all content views
CREATE POLICY "Admins can view all content views"
  ON content_views FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- STEP 10: Create RLS policies for user_sessions table
-- ============================================================================

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own sessions (for logout)
CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Community managers can view sessions for users in their communities
CREATE POLICY "Community managers can view community sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT up.id FROM user_profiles up
      WHERE up.community_id IN (
        SELECT get_managed_communities(auth.uid())
      )
    )
  );

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- STEP 11: Update communities policies for community managers
-- ============================================================================

-- Community managers can create communities
CREATE POLICY "Community managers can create communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'community_manager');

-- Community managers can view their managed communities
CREATE POLICY "Community managers can view managed communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT get_managed_communities(auth.uid())
    )
  );

-- Community managers can update their managed communities
CREATE POLICY "Community managers can update managed communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT get_managed_communities(auth.uid())
    )
  )
  WITH CHECK (
    id IN (
      SELECT get_managed_communities(auth.uid())
    )
  );

-- ============================================================================
-- STEP 12: Update user_profiles policies for community managers
-- ============================================================================

-- Community managers can view users in their managed communities
CREATE POLICY "Community managers can view community members"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT get_managed_communities(auth.uid())
    )
  );

-- Community managers can create users in their managed communities
CREATE POLICY "Community managers can create community members"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    community_id IN (
      SELECT get_managed_communities(auth.uid())
    )
  );

-- Community managers can update users in their managed communities
CREATE POLICY "Community managers can update community members"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    community_id IN (
      SELECT get_managed_communities(auth.uid())
    )
  )
  WITH CHECK (
    community_id IN (
      SELECT get_managed_communities(auth.uid())
    )
  );