/*
  # Add Community Manager DELETE Policy for Communities

  ## Overview
  This migration adds a DELETE policy to allow community managers to delete
  communities they manage, in addition to the existing admin-only delete policy.

  ## Changes Made

  ### communities table
  - Add DELETE policy for community managers to delete communities they manage
  - Existing admin DELETE policy remains unchanged

  ## Security
  
  ### DELETE Policies
  - Admins can delete any community (existing policy)
  - Community managers can delete only communities they manage
  - Regular users cannot delete communities
  
  ## Important Notes
  
  - Community deletion will cascade to related records through foreign key constraints
  - Deletion is a destructive operation and should be used with caution
  - Community managers can only delete communities they are assigned to manage
  - The policy uses the existing get_managed_communities() function for security
*/

-- ============================================================================
-- Add DELETE policy for community managers to delete communities they manage
-- ============================================================================

-- Community managers can delete communities they manage
CREATE POLICY "Community managers can delete managed communities"
  ON communities FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT get_managed_communities(auth.uid())
    )
  );
