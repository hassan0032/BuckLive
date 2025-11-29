-- Enable RLS on the bucket (if not already enabled, though buckets usually rely on storage.objects policies)
-- storage.buckets is a system table, we don't usually enable RLS on it directly for users, 
-- but we need policies on storage.objects.

-- ============================================================================
-- STORAGE POLICIES for 'documents' bucket
-- ============================================================================

-- Allow Admins ONLY to upload files to the 'documents' bucket
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
CREATE POLICY "Admins can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  public.is_admin(auth.uid())
);

-- Allow Admins OR Community Managers (for their community) to view files
-- We link to community_pdfs to verify the community_id safely
DROP POLICY IF EXISTS "Admins and Managers can view documents" ON storage.objects;
CREATE POLICY "Admins and Managers can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND (
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM community_pdfs cp
      WHERE cp.storage_path = name
      AND cp.community_id IN (
        SELECT * FROM get_managed_communities(auth.uid())
      )
    )
  )
);

-- Allow Admins ONLY to delete files in the 'documents' bucket
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;
CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  public.is_admin(auth.uid())
);

-- ============================================================================
-- TABLE POLICIES for 'community_pdfs' table
-- ============================================================================

-- Allow Admins ONLY to insert community pdfs
DROP POLICY IF EXISTS "Admins can insert community pdfs" ON community_pdfs;
CREATE POLICY "Admins can insert community pdfs"
ON community_pdfs FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
);

-- Allow Admins OR Community Managers (for their community) to view community pdfs
DROP POLICY IF EXISTS "Admins and Managers can view community pdfs" ON community_pdfs;
CREATE POLICY "Admins and Managers can view community pdfs"
ON community_pdfs FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid()) OR
  (
    community_id IN (
      SELECT * FROM get_managed_communities(auth.uid())
    )
  )
);

-- Allow Admins ONLY to delete community pdfs
DROP POLICY IF EXISTS "Admins can delete community pdfs" ON community_pdfs;
CREATE POLICY "Admins can delete community pdfs"
ON community_pdfs FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid())
);
