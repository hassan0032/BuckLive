/*
  # Add Public Share Links for Communities

  ## Overview
  Enables community managers to create shareable links that bypass login requirements.
  Anonymous users accessing these links can view community content based on the community's membership tier.

  ## Changes
  1. Create function to validate share tokens and get community info
  2. Update content_views table to allow NULL user_id (for anonymous views)
  3. Update RLS policies to allow anonymous users with valid share tokens to:
     - View communities (via share token)
     - View content (based on community tier)
     - Insert content_views (with community_id but no user_id)
  4. Grant execute permissions on validation function to anonymous users

  ## Security
  - Share tokens must be unique and valid
  - Anonymous access limited to communities with is_sharable = true
  - Content visibility respects community membership_tier
  - All public views tracked with community_id for analytics
*/

-- ============================================================================
-- STEP 1: Create function to validate share tokens and return community info
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_share_token(token text)
RETURNS TABLE(
  community_id uuid,
  membership_tier text,
  name text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.membership_tier,
    c.name
  FROM public.communities c
  WHERE c.sharable_token = token
    AND c.is_sharable = true
    AND c.is_active = true;
END;
$$;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.validate_share_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_share_token(text) TO authenticated;

-- ============================================================================
-- STEP 2: Update content_views table to allow NULL user_id for anonymous views
-- ============================================================================

-- Remove NOT NULL constraint from user_id (anonymous views won't have a user_id)
ALTER TABLE content_views
  ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint to ensure either user_id or community_id is present
ALTER TABLE content_views
  ADD CONSTRAINT content_views_user_or_community_check
  CHECK (user_id IS NOT NULL OR community_id IS NOT NULL);

-- ============================================================================
-- STEP 3: Create function to set share token in session (for RLS policies)
-- ============================================================================

-- This function will be called by the application to set the share token
-- in the session context for RLS policies to check
CREATE OR REPLACE FUNCTION public.set_share_token(token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set the token in session-local variable
  PERFORM set_config('app.share_token', token, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_share_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.set_share_token(text) TO authenticated;

-- ============================================================================
-- STEP 4: Update RLS policies for communities (allow anonymous read via share token)
-- ============================================================================

-- Allow anonymous users to view communities via share token
-- Note: Application will validate token and call set_share_token() before queries
CREATE POLICY "Anonymous users can view communities via share token"
  ON communities FOR SELECT
  TO anon
  USING (
    is_sharable = true
    AND is_active = true
    AND sharable_token IS NOT NULL
    AND sharable_token = current_setting('app.share_token', true)
  );

-- ============================================================================
-- STEP 5: Update RLS policies for content (allow anonymous access via share token)
-- ============================================================================

-- Helper function to get community tier from share token
CREATE OR REPLACE FUNCTION public.get_share_token_community_tier()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
DECLARE
  tier text;
BEGIN
  SELECT c.membership_tier INTO tier
  FROM public.communities c
  WHERE c.sharable_token = current_setting('app.share_token', true)
    AND c.is_sharable = true
    AND c.is_active = true
  LIMIT 1;
  
  RETURN COALESCE(tier, 'silver');
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'silver';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_share_token_community_tier() TO anon;
GRANT EXECUTE ON FUNCTION public.get_share_token_community_tier() TO authenticated;

-- Allow anonymous users to view content based on share token community tier
CREATE POLICY "Anonymous users can view content via share token"
  ON content FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.sharable_token = current_setting('app.share_token', true)
        AND c.is_sharable = true
        AND c.is_active = true
        AND (
          -- Silver tier content is visible to all communities
          required_tier = 'silver'
          OR
          -- Gold tier content requires gold community membership
          (required_tier = 'gold' AND c.membership_tier = 'gold')
        )
    )
  );

-- ============================================================================
-- STEP 6: Update RLS policies for content_views (allow anonymous inserts)
-- ============================================================================

-- Helper function to get community_id from share token
CREATE OR REPLACE FUNCTION public.get_share_token_community_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
DECLARE
  comm_id uuid;
BEGIN
  SELECT c.id INTO comm_id
  FROM public.communities c
  WHERE c.sharable_token = current_setting('app.share_token', true)
    AND c.is_sharable = true
    AND c.is_active = true
  LIMIT 1;
  
  RETURN comm_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_share_token_community_id() TO anon;
GRANT EXECUTE ON FUNCTION public.get_share_token_community_id() TO authenticated;

-- Allow anonymous users to insert content views with community_id (for analytics)
CREATE POLICY "Anonymous users can insert content views via share token"
  ON content_views FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND community_id IS NOT NULL
    AND community_id = public.get_share_token_community_id()
  );

-- Allow anonymous users to update their own content views (for duration tracking)
CREATE POLICY "Anonymous users can update own content views"
  ON content_views FOR UPDATE
  TO anon
  USING (
    user_id IS NULL
    AND community_id IS NOT NULL
    AND community_id = public.get_share_token_community_id()
  )
  WITH CHECK (
    user_id IS NULL
    AND community_id IS NOT NULL
    AND community_id = public.get_share_token_community_id()
  );

-- Allow anonymous users to view their own content views (minimal, for client-side tracking)
CREATE POLICY "Anonymous users can view own content views"
  ON content_views FOR SELECT
  TO anon
  USING (
    user_id IS NULL
    AND community_id IS NOT NULL
    AND community_id = public.get_share_token_community_id()
  );

-- ============================================================================
-- STEP 6: Create index for community-based content_views queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_content_views_community_id_user_null 
  ON content_views(community_id, viewed_at DESC) 
  WHERE user_id IS NULL;

