-- Optimize storage RLS policy to avoid joining with community_pdfs table.
-- Instead, we check if the file path starts with a community_id that the user manages.
-- This prevents potential RLS recursion issues and improves performance.

-- ============================================================================
-- STORAGE POLICIES for 'documents' bucket
-- ============================================================================

-- Drop the previous SELECT policy
DROP POLICY IF EXISTS "Admins and Managers can view documents" ON storage.objects;

-- Create optimized SELECT policy
CREATE POLICY "Admins and Managers can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND (
    public.is_admin(auth.uid()) OR
    (
      -- Extract the first part of the path (community_id) and check if user manages it.
      -- We cast the UUIDs from get_managed_communities to text for comparison.
      split_part(name, '/', 1) IN (
        SELECT community_id::text 
        FROM public.get_managed_communities(auth.uid())
      )
    )
  )
);
