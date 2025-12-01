/*
  # Update Notification Broadcast Triggers
  
  ## Overview
  This migration updates the notification triggers to broadcast to all relevant users:
  1. Community creation notifications → All admin users (type='community_manager')
  2. Admin notifications → All users (both admins and managers) (type='admin')
  
  ## Changes
  - Adds 'community_manager' as a valid notification type
  - Updates create_community_notification() to send to ALL admin role users
  - Updates create_admin_notification_broadcast() to send to ALL users (admins + managers)
*/

-- ============================================================================
-- Update notification type check constraint
-- ============================================================================

-- Drop the old constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check
-- Delete any existing notifications that don't match the new allowed types
-- This ensures the new constraint can be applied successfully
DELETE FROM notifications 
WHERE type NOT IN ('admin', 'community_manager')
-- Add new constraint with only 'admin' and 'community_manager' types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('admin', 'community_manager'))
-- ============================================================================
-- Update community creation notification trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION create_community_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create notification for ALL admin users with type='community_manager'
  -- Each admin gets their own copy with individual read tracking
  INSERT INTO notifications (type, user_id, title, name, is_read)
  SELECT 'community_manager', up.id, NEW.name, NEW.name, false
  FROM user_profiles up
  WHERE up.role = 'admin';
  
  RETURN NEW;
END;
$$
-- ============================================================================
-- Update admin notification broadcast trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION create_admin_notification_broadcast()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process admin-type notifications without a user_id (broadcast)
  IF NEW.type = 'admin' AND NEW.user_id IS NULL THEN
    -- Create a notification copy for ALL users (both admins and managers)
    -- Each user gets their own copy with individual read tracking
    INSERT INTO notifications (type, user_id, title, content, is_read)
    SELECT 'admin', up.id, NEW.title, NEW.content, false
    FROM user_profiles up
    WHERE up.role IN ('admin', 'community_manager');
    
    -- Delete the template notification (it was just a trigger to create copies)
    DELETE FROM notifications WHERE id = NEW.id;
    
    -- Return NULL to prevent the original INSERT from completing
    RETURN NULL;
  END IF;
  
  -- For other notifications, allow normal insert
  RETURN NEW;
END;
$$