/*
  # Fix Unindexed Foreign Keys

  ## Changes
  This migration adds missing indexes to foreign key columns to improve query performance:
  
  1. **communities.creator_id** - Index for creator lookup
  2. **community_managers.created_by** - Index for tracking who created manager assignments
  3. **content_versions.created_by** - Index for version author lookup
  4. **notifications.community_id** - Index for community-specific notifications
  5. **organization_managers.user_id** - Index for user-based organization manager lookups

  ## Performance Impact
  These indexes will significantly improve query performance for joins and lookups on these foreign key columns.
*/

-- Add index for communities.creator_id
CREATE INDEX IF NOT EXISTS idx_communities_creator_id 
ON communities(creator_id);

-- Add index for community_managers.created_by
CREATE INDEX IF NOT EXISTS idx_community_managers_created_by 
ON community_managers(created_by);

-- Add index for content_versions.created_by
CREATE INDEX IF NOT EXISTS idx_content_versions_created_by 
ON content_versions(created_by);

-- Add index for notifications.community_id
CREATE INDEX IF NOT EXISTS idx_notifications_community_id 
ON notifications(community_id);

-- Add index for organization_managers.user_id
CREATE INDEX IF NOT EXISTS idx_organization_managers_user_id 
ON organization_managers(user_id);