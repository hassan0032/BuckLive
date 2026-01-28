/*
  # Create content_questions table

  ## Overview
  This migration creates a table to store user questions about content.
  Both authenticated and unauthenticated users can submit questions.
  Email is optional to support anonymous questions.

  ## Changes
  1. Create content_questions table
  2. Add foreign key constraints
  3. Create indexes
  4. Enable RLS
  5. Create RLS policies for INSERT (public), SELECT (admin only), UPDATE/DELETE (admin only)
*/

-- ============================================================================
-- STEP 1: Create content_questions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NULL,
  question text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE public.content_questions IS 'Stores user questions about specific content items';
COMMENT ON COLUMN public.content_questions.email IS 'Optional email address - NULL for anonymous questions';

-- ============================================================================
-- STEP 2: Create indexes for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_content_questions_content_id ON public.content_questions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_questions_created_at ON public.content_questions(created_at DESC);

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.content_questions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS policies
-- ============================================================================

-- Drop existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS "Anyone can insert questions" ON public.content_questions;
DROP POLICY IF EXISTS "Admins can view all questions" ON public.content_questions;
DROP POLICY IF EXISTS "Admins can update questions" ON public.content_questions;
DROP POLICY IF EXISTS "Admins can delete questions" ON public.content_questions;

-- Policy 1: Allow all users (anonymous and authenticated) to insert questions
CREATE POLICY "Anyone can insert questions"
  ON public.content_questions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy 2: Only admins can view all questions
CREATE POLICY "Admins can view all questions"
  ON public.content_questions FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
  );

-- Policy 3: Only admins can update questions
CREATE POLICY "Admins can update questions"
  ON public.content_questions FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
  );

-- Policy 4: Only admins can delete questions
CREATE POLICY "Admins can delete questions"
  ON public.content_questions FOR DELETE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
  );

-- ============================================================================
-- STEP 5: Grant necessary permissions
-- ============================================================================

GRANT SELECT ON public.content_questions TO authenticated;
GRANT INSERT ON public.content_questions TO anon, authenticated;
GRANT UPDATE ON public.content_questions TO authenticated;
GRANT DELETE ON public.content_questions TO authenticated;
