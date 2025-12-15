-- Update RLS policies for invoices table

-- Drop existing policies that might rely on old structure or user_id
DROP POLICY IF EXISTS "Community managers can view invoices in their community" ON invoices;
DROP POLICY IF EXISTS "Community managers can insert invoices for their community" ON invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Admins and Managers can view invoices" ON invoices;

-- Policy: Org Admins can view ALL invoices
CREATE POLICY "Org Admins can view all invoices"
ON invoices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Policy: Community Managers can view invoices for communities they manage
-- This uses the community_managers junction table
CREATE POLICY "Community Managers can view managed community invoices"
ON invoices
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM community_managers cm
    WHERE cm.user_id = auth.uid()
    AND cm.community_id = invoices.community_id
  )
);

-- Policy: Allow invoice creation/updates?
-- Usually handled by service role (edge functions), but if frontend needs to create:
-- For now we assume edge functions handle creation/updates with service role, 
-- or we can add specific insertion policies if needed.
