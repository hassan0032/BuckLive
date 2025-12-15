-- Allow Organization Managers to manage community_managers for communities in their org

-- Org Managers can view community_managers for their org's communities
DROP POLICY IF EXISTS "Org Managers can view community managers in their org" ON public.community_managers;
CREATE POLICY "Org Managers can view community managers in their org"
  ON public.community_managers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      JOIN public.organization_managers om ON c.organization_id = om.organization_id
      WHERE c.id = community_managers.community_id
      AND om.user_id = auth.uid()
    )
  );

-- Org Managers can assign community managers to their org's communities
DROP POLICY IF EXISTS "Org Managers can assign community managers in their org" ON public.community_managers;
CREATE POLICY "Org Managers can assign community managers in their org"
  ON public.community_managers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities c
      JOIN public.organization_managers om ON c.organization_id = om.organization_id
      WHERE c.id = community_managers.community_id
      AND om.user_id = auth.uid()
    )
  );

-- Org Managers can remove community managers from their org's communities
DROP POLICY IF EXISTS "Org Managers can remove community managers in their org" ON public.community_managers;
CREATE POLICY "Org Managers can remove community managers in their org"
  ON public.community_managers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      JOIN public.organization_managers om ON c.organization_id = om.organization_id
      WHERE c.id = community_managers.community_id
      AND om.user_id = auth.uid()
    )
  );

