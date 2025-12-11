-- Org Managers can view invoices for communities in their organization
DROP POLICY IF EXISTS "Org Managers can view invoices in their org" ON public.invoices;
CREATE POLICY "Org Managers can view invoices in their org"
  ON public.invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      JOIN public.organization_managers om ON c.organization_id = om.organization_id
      WHERE c.id = invoices.community_id
      AND om.user_id = auth.uid()
    )
  );

