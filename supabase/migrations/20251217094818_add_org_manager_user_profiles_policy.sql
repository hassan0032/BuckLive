-- Add RLS policy for Organization Managers to view user_profiles under their organization
-- This allows org managers to see:
--   1. Members whose community_id belongs to a community in their organization
--   2. Community Managers who manage communities in their organization

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Org Managers can view user profiles in their org" ON public.user_profiles;

-- Create policy for Organization Managers to view user profiles under their organization
CREATE POLICY "Org Managers can view user profiles in their org"
  ON public.user_profiles
  FOR SELECT
  USING (
    -- User is a member in a community under the org manager's organization
    EXISTS (
      SELECT 1 
      FROM public.communities c
      JOIN public.organization_managers om ON c.organization_id = om.organization_id
      WHERE c.id = user_profiles.community_id
      AND om.user_id = auth.uid()
    )
    OR
    -- User is a community manager for a community under the org manager's organization
    EXISTS (
      SELECT 1 
      FROM public.community_managers cm
      JOIN public.communities c ON cm.community_id = c.id
      JOIN public.organization_managers om ON c.organization_id = om.organization_id
      WHERE cm.user_id = user_profiles.id
      AND om.user_id = auth.uid()
    )
  );
