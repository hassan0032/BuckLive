/*
  # Add Manager Name to Community Notifications
  
  ## Overview
  This migration updates the `create_community_notification` trigger function to include
  the community manager's name in the notification content.
  
  ## Changes
  - Updates `create_community_notification()` to fetch the manager's name from `user_profiles`
    using `created_by_manager_id` and store it in the `content` field.
*/

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
  -- Store manager's name in content field for display
  INSERT INTO notifications (type, user_id, title, name, content, is_read)
  SELECT 
    'community_manager', 
    up.id, 
    NEW.name, 
    NEW.name, 
    (SELECT first_name || ' ' || last_name FROM user_profiles WHERE id = NEW.created_by_manager_id),
    false
  FROM user_profiles up
  WHERE up.role = 'admin';
  
  RETURN NEW;
END;
$$