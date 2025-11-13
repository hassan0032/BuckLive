/*
  # Allow authenticated users to update their own content views

  ## Overview
  This migration adds an UPDATE policy for authenticated users to update their own content views.
  This enables duration tracking for authenticated users, allowing them to update the view_duration
  field as they consume content.

  ## Changes
  1. Add UPDATE policy for authenticated users to update their own content views
*/

-- ============================================================================
-- STEP 1: Allow authenticated users to update their own content views
-- ============================================================================

-- Drop any existing authenticated UPDATE policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can update own content views" ON content_views;

-- Create policy that allows authenticated users to update their own content views
-- This enables duration tracking for authenticated users
-- Users can only update records where user_id matches their auth.uid()
CREATE POLICY "Users can update own content views"
  ON content_views FOR UPDATE
  TO authenticated
  USING (
    user_id IS NOT NULL AND auth.uid() = user_id
  )
  WITH CHECK (
    user_id IS NOT NULL AND auth.uid() = user_id
  );

