-- Drop policy if it already exists
DROP POLICY IF EXISTS "Allow admin to delete invoices" ON "public"."invoices";

-- Policy to allow admins to DELETE invoices
-- Assumes 'user_profiles' table has 'id' matching auth.uid() and 'role' column.
CREATE POLICY "Allow admin to delete invoices"
ON "public"."invoices"
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);
