/*
  # Update RLS policy to allow all users to insert content views

  ## Overview
  This migration updates the "Users can insert own content views" policy to allow
  all authenticated users to insert content views without requiring the user_id
  to match auth.uid().

  ## Changes
  1. Drop all existing insert policies on content_views table
  2. Create updated policy that allows all authenticated users to insert content views
*/

-- ============================================================================
-- STEP 1: Drop all existing insert policies
-- ============================================================================

DROP POLICY IF EXISTS "All users can insert content views" ON content_views;
DROP POLICY IF EXISTS "Users can insert own content views" ON content_views;
DROP POLICY IF EXISTS "Anonymous users can insert content views" ON content_views;
DROP POLICY IF EXISTS "Anonymous users can insert content views via share token" ON content_views;

-- ============================================================================
-- STEP 2: Create updated policy that allows all users to insert
-- ============================================================================

CREATE POLICY "All users can insert content views"
  ON content_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
