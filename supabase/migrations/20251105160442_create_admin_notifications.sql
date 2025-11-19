/*
  # Create Admin Notifications Table

  ## Overview
  This migration creates a notification system where admins can create and delete
  posts/notifications that are only visible to community managers.

  ## New Table

  ### admin_notifications
  Stores notifications created by admins for community managers.
  - `id` (uuid, primary key) - Unique identifier
  - `title` (text, NOT NULL) - Notification title
  - `content` (text, NOT NULL) - Notification body/content
  - `created_at` (timestamptz) - When notification was created

  ## Security

  ### RLS Policies
  - Admins: can create, delete, and read all notifications
  - Community managers: read-only access to all notifications
  - Members: no access

  ## Indexes
  - `created_at DESC` for displaying newest first
*/

-- ============================================================================
-- STEP 1: Create admin_notifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for displaying notifications in chronological order (newest first)
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);

-- ============================================================================
-- STEP 2: Enable RLS on admin_notifications table
-- ============================================================================

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Create RLS policies for admin_notifications table
-- ============================================================================

DROP POLICY IF EXISTS "Admins can read all notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Community managers can read notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON admin_notifications;

-- Admins can read all notifications
CREATE POLICY "Admins can read all notifications"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Community managers can read all notifications
CREATE POLICY "Community managers can read notifications"
  ON admin_notifications FOR SELECT
  TO authenticated
  USING (public.get_user_role(auth.uid()) = 'community_manager');

-- Admins can create notifications
CREATE POLICY "Admins can create notifications"
  ON admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins can delete notifications
CREATE POLICY "Admins can delete notifications"
  ON admin_notifications FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

