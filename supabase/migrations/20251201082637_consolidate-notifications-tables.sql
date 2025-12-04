/*
  # Consolidate Notification Tables
  
  ## Overview
  This migration consolidates three notification tables (notifications, admin_notifications, 
  and admin_notification_reads) into a single unified notifications table.
  
  ## New Unified Table Structure
  
  ### notifications
  - `id` (uuid, primary key) - Unique identifier
  - `type` (text, NOT NULL) - Notification type: 'user' or 'admin'
  - `user_id` (uuid, nullable) - User who receives the notification
  - `title` (text) - Notification title
  - `content` (text) - Detailed notification content
  - `name` (text) - Legacy name field for simple notifications
  - `is_read` (boolean) - Read status
  - `read_at` (timestamptz) - When notification was marked as read
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ## Design
  - Type discriminator ('user' vs 'admin') distinguishes notification types
  - Admin notifications are duplicated per community manager for individual read tracking
  - User notifications are user-specific with direct relationship
  - Built-in read tracking eliminates need for junction table
  
  ## Security
  ### RLS Policies
  - Users: Read/update own notifications
  - Community Managers: Read admin-type notifications sent to them
  - Admins: Full CRUD access
*/

-- ============================================================================
-- STEP 1: Drop old tables
-- ============================================================================

-- Drop old policies first
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can read all notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Community managers can read notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Users can view own read status" ON admin_notification_reads;
DROP POLICY IF EXISTS "Admins can view all read statuses" ON admin_notification_reads;
DROP POLICY IF EXISTS "Admins can insert read statuses" ON admin_notification_reads;
DROP POLICY IF EXISTS "Users can update own read status" ON admin_notification_reads;
DROP POLICY IF EXISTS "Admins can update read statuses" ON admin_notification_reads;
DROP POLICY IF EXISTS "Admins can delete read statuses" ON admin_notification_reads;
-- Drop triggers and functions
DROP TRIGGER IF EXISTS on_community_created ON communities;
DROP TRIGGER IF EXISTS on_admin_notification_created ON admin_notifications;
DROP FUNCTION IF EXISTS create_community_notification();
DROP FUNCTION IF EXISTS create_admin_notification_read_entries();
-- Drop old tables
DROP TABLE IF EXISTS admin_notification_reads;
DROP TABLE IF EXISTS admin_notifications;
DROP TABLE IF EXISTS notifications;
-- ============================================================================
-- STEP 2: Create unified notifications table
-- ============================================================================

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Notification type discriminator
  type text NOT NULL CHECK (type IN ('user', 'admin')),
  
  -- User relationship (required for user notifications, set for admin notification copies)
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Content fields
  title text,
  content text,
  name text, -- Legacy field for simple notifications
  
  -- Read tracking
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz DEFAULT timezone('utc', now())
);
-- ============================================================================
-- STEP 3: Create indexes for optimal performance
-- ============================================================================

-- User-specific queries with type filtering
CREATE INDEX idx_notifications_user_type ON notifications(user_id, type);
-- Read status queries
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
-- Chronological ordering (newest first)
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
-- Type filtering
CREATE INDEX idx_notifications_type ON notifications(type);
-- Combined index for common queries
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
-- ============================================================================
-- STEP 4: Enable RLS
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- ============================================================================
-- STEP 5: Create RLS policies
-- ============================================================================

-- SELECT POLICIES
-- Users can view their own notifications (both user and admin types)
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
-- INSERT POLICIES
-- Only admins can insert notifications directly
CREATE POLICY "Admins can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
-- UPDATE POLICIES
-- Users can update their own read status
CREATE POLICY "Users can update own read status"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- Admins can update any notification
CREATE POLICY "Admins can update all notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
-- DELETE POLICIES
-- Only admins can delete notifications
CREATE POLICY "Admins can delete notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
-- ============================================================================
-- STEP 6: Create trigger functions
-- ============================================================================

-- Function to create user notification when a community is created
CREATE OR REPLACE FUNCTION create_community_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create user-type notification for the community creator
  INSERT INTO notifications (type, user_id, title, name, is_read)
  VALUES ('user', auth.uid(), NEW.name, NEW.name, false);
  
  RETURN NEW;
END;
$$;
-- Function to create notification copies for all community managers
CREATE OR REPLACE FUNCTION create_admin_notification_broadcast()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process admin-type notifications without a user_id (broadcast)
  IF NEW.type = 'admin' AND NEW.user_id IS NULL THEN
    -- Create a notification copy for each community manager
    INSERT INTO notifications (type, user_id, title, content, is_read)
    SELECT 'admin', up.id, NEW.title, NEW.content, false
    FROM user_profiles up
    WHERE up.role = 'community_manager';
    
    -- Delete the template notification (it was just a trigger to create copies)
    DELETE FROM notifications WHERE id = NEW.id;
    
    -- Return NULL to prevent the original INSERT from completing
    RETURN NULL;
  END IF;
  
  -- For other notifications, allow normal insert
  RETURN NEW;
END;
$$;
-- ============================================================================
-- STEP 7: Create triggers
-- ============================================================================

-- Trigger for community creation notifications
CREATE TRIGGER on_community_created
  AFTER INSERT ON communities
  FOR EACH ROW
  EXECUTE FUNCTION create_community_notification();
-- Trigger for admin notification broadcasts
CREATE TRIGGER on_admin_notification_broadcast
  BEFORE INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.type = 'admin' AND NEW.user_id IS NULL)
  EXECUTE FUNCTION create_admin_notification_broadcast();
-- ============================================================================
-- STEP 8: Add updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();