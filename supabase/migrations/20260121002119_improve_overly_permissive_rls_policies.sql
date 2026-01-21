/*
  # Improve Overly Permissive RLS Policies

  ## Changes
  This migration tightens RLS policies that were previously too permissive (always true).

  ## Policies Updated
  1. **content_feedback** - Restrict to valid, published content only
  2. **content_views** - Ensure only valid content can be tracked
  3. **payments** - Restrict insert to service_role only (for Stripe webhooks)

  ## Security Impact
  These changes prevent abuse while maintaining required functionality for:
  - Anonymous feedback submission (but only for published content)
  - Content view tracking (but only for valid content)
  - Payment record creation (service role only)
*/

-- ============================================================
-- CONTENT_FEEDBACK POLICIES
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can insert feedback" ON content_feedback;

-- Create a more restrictive policy that only allows feedback for published content
CREATE POLICY "Users can submit feedback for published content"
  ON content_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_feedback.content_id
      AND content.status = 'published'
    )
  );

-- ============================================================
-- CONTENT_VIEWS POLICIES
-- ============================================================

-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "All users can insert content views" ON content_views;

-- Create a more restrictive policy that only allows tracking views for valid content
CREATE POLICY "Users can track views for valid content"
  ON content_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_views.content_id
      AND content.status = 'published'
    )
  );

-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "All users can update content views" ON content_views;

-- Create a more restrictive policy that allows updating view duration
-- This is needed for tracking how long users view content
CREATE POLICY "Users can update their own content view duration"
  ON content_views FOR UPDATE
  TO anon, authenticated
  USING (
    -- Allow updates to existing view records
    -- For authenticated users, match their user_id
    -- For anonymous users, we allow updates (needed for public share tracking)
    (user_id IS NULL) OR (user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    -- Ensure the content still exists and is published
    EXISTS (
      SELECT 1 FROM content
      WHERE content.id = content_views.content_id
      AND content.status = 'published'
    )
    AND ((user_id IS NULL) OR (user_id = (SELECT auth.uid())))
  );

-- ============================================================
-- PAYMENTS POLICIES
-- ============================================================

-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "System can insert payments" ON payments;

-- Payments should only be inserted by the service role (Stripe webhooks)
-- Regular authenticated users should NOT be able to create payment records
-- If needed, we can create a specific policy for service_role, but by default
-- with RLS enabled and no permissive policy for authenticated users, only
-- service_role (which bypasses RLS) can insert.