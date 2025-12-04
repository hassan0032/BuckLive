-- Drop policy allowing community managers to insert invoices
DROP POLICY IF EXISTS "Community managers can insert invoices for their community" 
ON invoices;