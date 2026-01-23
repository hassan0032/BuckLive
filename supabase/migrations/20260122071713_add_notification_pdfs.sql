-- Create the 'notification-pdfs' storage bucket (public) - only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'notification-pdfs'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('notification-pdfs', 'notification-pdfs', true, 52428800); -- 50MB
  END IF;
END $$;

-- Add PDF columns to notifications table (IF NOT EXISTS already included)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS pdf_storage_path text;

-- Policy: Admins can upload to notification-pdfs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can upload notification pdfs'
  ) THEN
    CREATE POLICY "Admins can upload notification pdfs"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'notification-pdfs' AND
      public.is_admin(auth.uid())
    );
  END IF;
END $$;

-- Policy: Authenticated users can view notification pdfs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view notification pdfs'
  ) THEN
    CREATE POLICY "Authenticated users can view notification pdfs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING ( bucket_id = 'notification-pdfs' );
  END IF;
END $$;

-- Policy: Admins can delete notification pdfs (optional, but good for cleanup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Admins can delete notification pdfs'
  ) THEN
    CREATE POLICY "Admins can delete notification pdfs"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'notification-pdfs' AND
      public.is_admin(auth.uid())
    );
  END IF;
END $$;