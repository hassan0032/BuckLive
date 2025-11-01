/*
  # Allow NULL user_id in content_views table for unauthenticated users

  ## Overview
  This migration updates the content_views table to allow NULL values in the user_id column,
  enabling content view tracking for unauthenticated users.

  ## Changes
  1. Remove NOT NULL constraint from user_id column
  2. Update RLS policies to allow anonymous users to insert content views
  3. Update authenticated user policies to handle NULL user_id cases
*/

-- ============================================================================
-- STEP 1: Remove NOT NULL constraint from user_id column
-- ============================================================================

DO $$
BEGIN
  -- Check if the column currently has NOT NULL constraint
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'content_views' 
      AND column_name = 'user_id' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE content_views
      ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Update existing authenticated INSERT policy
-- ============================================================================

-- Drop the existing policy that requires user_id to match auth.uid()
DROP POLICY IF EXISTS "Users can insert own content views" ON content_views;

-- Create updated policy that allows authenticated users to insert with their user_id
-- Authenticated users must use their own user_id (not NULL) for proper tracking
CREATE POLICY "Users can insert own content views"
  ON content_views FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IS NOT NULL AND auth.uid() = user_id
  );

-- ============================================================================
-- STEP 3: Update authenticated SELECT policy to handle NULL user_id
-- ============================================================================

-- The existing "Users can view own content views" policy should still work
-- but we need to ensure it handles NULL user_id cases correctly
-- Note: Users with NULL user_id won't match auth.uid(), so they won't see those rows
-- This is expected behavior - anonymous views aren't visible to authenticated users

-- ============================================================================
-- STEP 4: Allow anonymous users to insert content views with NULL user_id
-- ============================================================================

-- Drop any existing anonymous INSERT policies first to avoid conflicts
DROP POLICY IF EXISTS "Anonymous users can insert content views" ON content_views;
DROP POLICY IF EXISTS "Anonymous users can insert content views via share token" ON content_views;

CREATE POLICY "Anonymous users can insert content views"
  ON content_views FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
  );

-- ============================================================================
-- STEP 5: Allow anonymous users to update their own content views
-- ============================================================================

-- Drop any existing anonymous UPDATE policies first to avoid conflicts
DROP POLICY IF EXISTS "Anonymous users can update own content views" ON content_views;

CREATE POLICY "Anonymous users can update own content views"
  ON content_views FOR UPDATE
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- ============================================================================
-- STEP 6: Allow anonymous users to view their own content views
-- ============================================================================

-- Drop any existing anonymous SELECT policies first to avoid conflicts
DROP POLICY IF EXISTS "Anonymous users can view own content views" ON content_views;

CREATE POLICY "Anonymous users can view own content views"
  ON content_views FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- ============================================================================
-- STEP 7: Update community managers and admins policies to include NULL user_id views
-- ============================================================================

-- The existing policies for community managers and admins should already work
-- as they query by community_id, which can exist for anonymous views
-- No changes needed here since they don't filter by user_id

