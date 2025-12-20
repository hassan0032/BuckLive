/*
  # Improve Community Notification NULL Handling
  
  ## Overview
  This migration improves the `create_community_notification` trigger function to handle
  cases where `created_by_manager_id` might be NULL by providing a fallback.
  
  ## Changes
  - Updates `create_community_notification()` to use COALESCE for better NULL handling
  - Provides "Unknown Manager" fallback when manager name cannot be determined
*/

-- ============================================================================
-- Update community creation notification trigger with NULL handling
-- ============================================================================

CREATE OR REPLACE FUNCTION create_community_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create notification for ALL admin users with type='community_manager'
  -- Each admin gets their own copy with individual read tracking
  -- Store manager's name in content field for display, with fallback for NULL
  INSERT INTO notifications (type, user_id, title, name, content, is_read)
  SELECT 
    'community_manager', 
    up.id, 
    NEW.name, 
    NEW.name, 
    COALESCE(
      (SELECT first_name || ' ' || last_name FROM user_profiles WHERE id = NEW.created_by_manager_id OR id = NEW.organization_id),
      'Unknown Manager'
    ),
    false
  FROM user_profiles up
  WHERE up.role = 'admin';
  
  RETURN NEW;
END;
$$;
