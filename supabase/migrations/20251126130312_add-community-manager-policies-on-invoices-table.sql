-- Allow community manager to select invoices
CREATE POLICY "Community managers can view invoices in their community"
ON public.invoices
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM community_managers cm
    WHERE cm.user_id = auth.uid() AND cm.community_id = invoices.community_id
  )
);

-- Allow community manager to insert invoices
CREATE POLICY "Community managers can insert invoices for their community"
ON public.invoices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM community_managers cm
    WHERE cm.user_id = auth.uid() AND cm.community_id = invoices.community_id
  )
);
