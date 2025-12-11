-- Add organization_id to communities
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_communities_organization_id ON public.communities(organization_id);

-- Update RLS policies for communities

-- Org Managers can view communities in their organization
DROP POLICY IF EXISTS "Org Managers can view communities in their org" ON public.communities;
CREATE POLICY "Org Managers can view communities in their org"
  ON public.communities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_managers om
      WHERE om.organization_id = communities.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Org Managers can insert communities into their organization
DROP POLICY IF EXISTS "Org Managers can insert communities into their org" ON public.communities;
CREATE POLICY "Org Managers can insert communities into their org"
  ON public.communities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_managers om
      WHERE om.organization_id = communities.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- Org Managers can update communities in their organization
DROP POLICY IF EXISTS "Org Managers can update communities in their org" ON public.communities;
CREATE POLICY "Org Managers can update communities in their org"
  ON public.communities
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_managers om
      WHERE om.organization_id = communities.organization_id
      AND om.user_id = auth.uid()
    )
  );

