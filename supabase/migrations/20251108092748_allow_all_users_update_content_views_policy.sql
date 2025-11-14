/*
  # Update content_views update policy to allow all users

  ## Overview
  This migration removes the user_id NULL restriction from the existing
  "All users can update content views" policy so that both anonymous and
  authenticated users can update any content view record. This supports
  use cases where user_id is present (authenticated sessions) while still
  permitting anonymous duration tracking.

  ## Changes
  1. Drop the previous policy definition.
  2. Recreate the policy allowing unrestricted updates for anon/authenticated roles.
*/

--- ============================================================================
--- Allow all users to update any content_views record
--- ============================================================================

DROP POLICY IF EXISTS "All users can update content views" ON content_views;

CREATE POLICY "All users can update content views"
  ON content_views FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);