/*
  # Restrict Admin Notifications to Managers Only
  
  ## Overview
  This migration updates the `create_admin_notification_broadcast` trigger function to 
  exclude admins from receiving broadcast notifications.
  
  ## Changes
  - Updates `create_admin_notification_broadcast()` to only select users with 
    role = 'community_manager'.
  - This ensures admins don't receive copies of notifications they (or other admins) created.
*/

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
    -- Create a notification copy for community managers ONLY
    -- Admins are excluded from receiving these notifications
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
