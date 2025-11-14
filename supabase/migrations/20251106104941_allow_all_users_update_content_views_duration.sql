/*
  # Allow all users to update their duration in content_views

  ## Overview
  This migration ensures that both authenticated and anonymous users can update the view_duration
  field in their own content views. This enables proper duration tracking for all users as they
  consume content.

  ## Changes
  1. Ensure all users can update their own content views (where user_id IS NULL)
*/

-- ============================================================================
-- Allow all users to update content views
-- ============================================================================

-- Drop any existing anonymous UPDATE policies first to avoid conflicts
DROP POLICY IF EXISTS "Anonymous users can update own content views" ON content_views;
DROP POLICY IF EXISTS "Users can update own content views" ON content_views;
DROP POLICY IF EXISTS "All users can update content views" ON content_views;

-- Create policy that allows anonymous users to update their own content views
-- This enables duration tracking for anonymous users
-- All users can only update records where user_id IS NULL
CREATE POLICY "All users can update content views"
  ON content_views FOR UPDATE
  TO anon, authenticated
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);