/*
  # Database Updates for Communities and Notifications
  
  ## Changes
  1. Add `creator_id` to `communities` table
  2. Add `community_id` to `notifications` table with CASCADE delete
  3. Update `create_community_notification` trigger function
  4. Backfill and fix existing notifications
  5. Delete orphaned notifications
*/

-- 1. Add creator_id to communities
ALTER TABLE communities ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL;

-- 2. Backfill creator_id
DO $$
DECLARE
    super_admin_id uuid;
BEGIN
    -- Find Super Admin ID
    SELECT id INTO super_admin_id FROM user_profiles 
    WHERE (first_name = 'Super' AND last_name = 'Admin')
    LIMIT 1;

    -- Update communities where organization_id is NULL
    UPDATE communities c
    SET creator_id = COALESCE(
        (
            SELECT cm.user_id 
            FROM community_managers cm 
            WHERE cm.community_id = c.id 
            ORDER BY cm.created_at ASC 
            LIMIT 1
        ),
        super_admin_id
    )
    WHERE c.organization_id IS NULL AND c.creator_id IS NULL;
END $$;

-- 3. Update notifications table with community_id
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES communities(id) ON DELETE CASCADE;

-- 4. Backfill community_id and fix title/content in notifications
-- We swap title and content as requested (title = creator name, content = community name)
UPDATE notifications n
SET 
  community_id = c.id,
  title = n.content, -- Old content was manager name
  content = c.name,  -- Community name
  name = c.name      -- Legacy name field
FROM communities c
WHERE n.type = 'community_manager'
AND (n.name = c.name OR n.title = c.name);

-- 5. Delete orphan notifications (where community does not exist)
DELETE FROM notifications 
WHERE type = 'community_manager' 
AND community_id IS NULL;

-- 6. Update trigger function create_community_notification
-- To set title as the name of community creator and content as the name of community.
CREATE OR REPLACE FUNCTION create_community_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    creator_name text;
BEGIN
    -- Get creator's name from creator_id if available
    IF NEW.creator_id IS NOT NULL THEN
        SELECT first_name || ' ' || last_name INTO creator_name 
        FROM user_profiles WHERE id = NEW.creator_id;
    END IF;

    -- Fallback for organization-owned or missing creator_id
    IF creator_name IS NULL THEN
        creator_name := COALESCE(
            (SELECT first_name || ' ' || last_name 
             FROM user_profiles up2
             JOIN organization_managers om ON om.user_id = up2.id
             WHERE om.organization_id = NEW.organization_id
             LIMIT 1),
            'Unknown Manager'
        );
    END IF;

    -- Create notification for ALL admin users
    INSERT INTO notifications (type, user_id, community_id, title, name, content, is_read)
    SELECT 
        'community_manager', 
        up.id, 
        NEW.id,
        creator_name, -- Title as creator name
        NEW.name,     -- Name as community name (legacy)
        NEW.name,     -- Content as community name
        false
    FROM user_profiles up
    WHERE up.role = 'admin';
    
    RETURN NEW;
END;
$$;
