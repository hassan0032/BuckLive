-- Add policy to allow admins to UPDATE invoices
-- This enables admins to change invoice status

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Admins can update invoices" ON public.invoices;

-- Create policy for admins to update invoices
CREATE POLICY "Admins can update invoices"
ON public.invoices
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));