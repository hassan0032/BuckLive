/*
  # Add enable_questions column to content table

  ## Overview
  This migration adds a boolean column to the content table that allows admins
  to enable/disable question submissions for individual content items.

  ## Changes
  1. Add enable_questions column (default false)
*/

-- ============================================================================
-- Add enable_questions column to content table
-- ============================================================================

ALTER TABLE public.content
ADD COLUMN IF NOT EXISTS enable_questions boolean DEFAULT false NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.content.enable_questions IS 'Whether users can submit questions about this content';
