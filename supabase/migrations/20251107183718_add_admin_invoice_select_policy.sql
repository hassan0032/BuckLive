-- Add policy to allow admins to SELECT all invoices
-- This enables admins to view invoices for all communities

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;

-- Create policy for admins to view all invoices
CREATE POLICY "Admins can view all invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));