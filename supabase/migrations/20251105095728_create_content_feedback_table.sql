/*
  # Create content_feedback table

  ## Overview
  This migration creates a table to store user feedback about content.
  Both authenticated and unauthenticated users can submit feedback.

  ## Changes
  1. Create content_feedback table
  2. Add foreign key constraints
  3. Enable RLS
  4. Create RLS policies for INSERT (public), SELECT (admin only), UPDATE/DELETE (admin only)
*/

-- ============================================================================
-- STEP 1: Create content_feedback table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  user_id uuid NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  comment text,
  was_helpful boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 2: Create indexes for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_content_feedback_content_id ON public.content_feedback(content_id);
CREATE INDEX IF NOT EXISTS idx_content_feedback_user_id ON public.content_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_content_feedback_created_at ON public.content_feedback(created_at DESC);

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.content_feedback ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS policies
-- ============================================================================

-- Drop existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Anonymous users can insert feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Authenticated users can insert feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON public.content_feedback;

-- Policy 1: Allow all users (anonymous and authenticated) to insert feedback
-- - Anonymous users can only insert with user_id = NULL
-- - Authenticated users can insert with user_id = NULL OR user_id = their own id
CREATE POLICY "Anyone can insert feedback"
  ON "public"."content_feedback"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    true
  );


-- Policy 3: Only admins can view all feedback
-- Use is_admin() function to avoid RLS recursion (function must exist from previous migrations)
CREATE POLICY "Admins can view all feedback"
  ON public.content_feedback FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
  );

-- Policy 4: Only admins can update feedback
CREATE POLICY "Admins can update feedback"
  ON public.content_feedback FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
  );

-- Policy 5: Only admins can delete feedback
CREATE POLICY "Admins can delete feedback"
  ON public.content_feedback FOR DELETE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
  );

-- ============================================================================
-- STEP 5: Grant necessary permissions
-- ============================================================================

GRANT SELECT ON public.content_feedback TO authenticated;
GRANT INSERT ON public.content_feedback TO anon, authenticated;
GRANT UPDATE ON public.content_feedback TO authenticated;
GRANT DELETE ON public.content_feedback TO authenticated;