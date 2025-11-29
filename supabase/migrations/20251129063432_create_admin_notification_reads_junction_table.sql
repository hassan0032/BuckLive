-- Junction table to track which users have read admin notifications
-- This enables showing unread indicators and tracking read status per user

-- Create the junction table
CREATE TABLE IF NOT EXISTS admin_notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_notification_id uuid NOT NULL REFERENCES admin_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  read_at timestamptz
);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notification_reads_unique 
  ON admin_notification_reads(admin_notification_id, user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_admin_notification_reads_notification 
  ON admin_notification_reads(admin_notification_id);

CREATE INDEX IF NOT EXISTS idx_admin_notification_reads_user 
  ON admin_notification_reads(user_id);

CREATE INDEX IF NOT EXISTS idx_admin_notification_reads_is_read 
  ON admin_notification_reads(is_read);

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_admin_notification_created ON admin_notifications;
DROP FUNCTION IF EXISTS create_admin_notification_read_entries();

-- Function to create read tracking entries for all community managers when a notification is created
CREATE OR REPLACE FUNCTION create_admin_notification_read_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create a read tracking entry for each community manager
  INSERT INTO admin_notification_reads (admin_notification_id, user_id, is_read)
  SELECT NEW.id, up.id, false
  FROM user_profiles up
  WHERE up.role = 'community_manager';
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically create read entries when an admin notification is created
CREATE TRIGGER on_admin_notification_created
  AFTER INSERT ON admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION create_admin_notification_read_entries();
