-- Add target_tier column to notifications table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'target_tier'
  ) THEN
    ALTER TABLE notifications ADD COLUMN target_tier text NOT NULL DEFAULT 'all' CHECK (target_tier IN ('all', 'gold', 'silver'));
  END IF;
END $$;

-- Update the broadcast function to filter by target_tier
CREATE OR REPLACE FUNCTION create_admin_notification_broadcast()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process admin-type notifications without a user_id (broadcast)
  IF NEW.type = 'admin' AND NEW.user_id IS NULL THEN
    
    -- Create notification copies for relevant managers based on tier
    INSERT INTO notifications (type, user_id, title, content, pdf_url, pdf_storage_path, is_read, target_tier)
    SELECT 
      'admin', 
      up.id, 
      NEW.title, 
      NEW.content, 
      NEW.pdf_url, 
      NEW.pdf_storage_path, 
      false,
      NEW.target_tier
    FROM user_profiles up
    WHERE 
      -- Filter for Community Managers
      (
        up.role = 'community_manager' AND (
          NEW.target_tier = 'all' OR 
          EXISTS (
            SELECT 1 FROM community_managers cm
            JOIN communities c ON cm.community_id = c.id
            WHERE cm.user_id = up.id 
            AND c.membership_tier = NEW.target_tier
          )
        )
      )
      OR
      -- Filter for Organization Managers
      (
        up.role IN ('organization_manager') AND (
          NEW.target_tier = 'all' OR 
          EXISTS (
            SELECT 1 FROM organization_managers om
            JOIN communities c ON c.organization_id = om.organization_id
            WHERE om.user_id = up.id 
            AND c.membership_tier = NEW.target_tier
          )
        )
      );

    -- Delete the template notification (it was just a trigger to create copies)
    DELETE FROM notifications WHERE id = NEW.id;

    -- Return NULL to prevent the original INSERT from completing
    RETURN NULL;
  END IF;

  -- For other notifications, allow normal insert
  RETURN NEW;
END;
$$;
