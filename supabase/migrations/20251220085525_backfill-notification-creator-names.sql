/*
  # Backfill Notification Creator Names
  
  ## Overview
  This migration backfills the `content` field for existing community creation notifications
  with the actual creator's name.
  
  ## Changes
  - Updates existing notifications of type 'community_manager' to populate the content field
  - For communities with created_by_manager_id: uses that user's name
  - For communities created by OMs (organization_id set): looks up the OM's name
  - Provides "Unknown Manager" fallback when creator cannot be determined
*/

-- ============================================================================
-- Backfill notification content with creator names
-- ============================================================================

UPDATE notifications n
SET content = COALESCE(
  -- First try: get name from created_by_manager_id (for CMs)
  (SELECT up.first_name || ' ' || up.last_name 
   FROM user_profiles up
   JOIN communities c ON c.id = (
     SELECT id FROM communities WHERE name = n.name LIMIT 1
   )
   WHERE up.id = c.created_by_manager_id
   LIMIT 1),
  
  -- Second try: get OM name from organization_id (for OMs)
  (SELECT up.first_name || ' ' || up.last_name 
   FROM user_profiles up
   JOIN organization_managers om ON om.user_id = up.id
   JOIN communities c ON c.organization_id = om.organization_id
   WHERE c.name = n.name
   LIMIT 1),
  
  -- Fallback if neither works
  'Unknown Manager'
)
WHERE n.type = 'community_manager'
  AND (n.content IS NULL OR n.content = '');

-- ============================================================================
-- Add comment
-- ============================================================================

COMMENT ON TABLE notifications IS 'Unified notifications table. For type=community_manager, content field stores the creator name.';
