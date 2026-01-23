-- Update the broadcast trigger to include Organization Managers and copy PDF fields
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
    INSERT INTO notifications (type, user_id, title, content, pdf_url, pdf_storage_path, is_read)
    SELECT 'admin', up.id, NEW.title, NEW.content, NEW.pdf_url, NEW.pdf_storage_path, false
    FROM user_profiles up
    WHERE up.role IN ('community_manager', 'organization_manager');

    -- Delete the template notification (it was just a trigger to create copies)
    DELETE FROM notifications WHERE id = NEW.id;

    -- Return NULL to prevent the original INSERT from completing
    RETURN NULL;
  END IF;

  -- For other notifications, allow normal insert
  RETURN NEW;
END;
$$;