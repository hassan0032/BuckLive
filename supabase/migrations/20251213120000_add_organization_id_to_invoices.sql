-- Add organization_id to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);

-- Backfill organization_id from communities
-- We update invoices where organization_id is NULL by joining with communities
UPDATE public.invoices i
SET organization_id = c.organization_id
FROM public.communities c
WHERE i.community_id = c.id
AND i.organization_id IS NULL;

-- Update RLS policies for invoices

-- Drop old complex policy
DROP POLICY IF EXISTS "Org Managers can view invoices in their org" ON public.invoices;

-- Create new simplified policy
CREATE POLICY "Org Managers can view invoices in their org"
  ON public.invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_managers om
      WHERE om.organization_id = invoices.organization_id
      AND om.user_id = auth.uid()
    )
  );
