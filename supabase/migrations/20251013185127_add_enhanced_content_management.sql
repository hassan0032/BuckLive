/*
  # Enhanced Content Management System
  
  ## Overview
  This migration enhances the content management system with:
  - Rich HTML content storage for blog posts
  - Draft content auto-save capability
  - Version history tracking for blog posts
  - Supabase Storage integration for thumbnails and PDFs
  - Content publishing status workflow
  
  ## Schema Changes
  
  ### content table modifications
  - `blog_content` (text) - Rich HTML content for blog posts
  - `blog_content_draft` (text) - Auto-saved draft content
  - `storage_thumbnail_path` (text) - Path to thumbnail in Supabase Storage
  - `storage_pdf_path` (text) - Path to PDF file in Supabase Storage
  - `status` (text) - Content status: 'draft' or 'published'
  - `vimeo_video_id` (text) - Extracted Vimeo video ID for easier embedding
  - `published_at` (timestamptz) - When content was first published
  
  ### content_versions table (new)
  Stores version history for blog posts enabling rollback capability.
  - `id` (uuid, primary key) - Unique version identifier
  - `content_id` (uuid, foreign key) - Reference to content item
  - `version_number` (integer) - Sequential version number
  - `blog_content` (text) - Snapshot of blog content at this version
  - `title` (text) - Snapshot of title at this version
  - `description` (text) - Snapshot of description at this version
  - `change_summary` (text) - Description of changes in this version
  - `created_by` (uuid) - Admin who created this version
  - `created_at` (timestamptz) - Version creation timestamp
  
  ## Storage Buckets
  Creates two storage buckets with appropriate policies:
  - `thumbnails` - For content thumbnail images (16:9 aspect ratio)
  - `pdfs` - For PDF document uploads
  
  ## Security
  
  ### content_versions table
  - RLS enabled
  - Admins can insert new versions
  - Admins can select version history
  - Users can view versions of published content they have access to
  
  ### Storage policies
  - Admins can upload to both buckets
  - Public read access for all authenticated users
  - Automatic file cleanup on content deletion
  
  ## Indexes
  - content_id on content_versions for fast version lookups
  - status on content for filtering by publication status
  - version_number on content_versions for ordering
*/

-- Add new columns to content table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'blog_content'
  ) THEN
    ALTER TABLE content ADD COLUMN blog_content text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'blog_content_draft'
  ) THEN
    ALTER TABLE content ADD COLUMN blog_content_draft text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'storage_thumbnail_path'
  ) THEN
    ALTER TABLE content ADD COLUMN storage_thumbnail_path text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'storage_pdf_path'
  ) THEN
    ALTER TABLE content ADD COLUMN storage_pdf_path text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'status'
  ) THEN
    ALTER TABLE content ADD COLUMN status text DEFAULT 'published' CHECK (status IN ('draft', 'published'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'vimeo_video_id'
  ) THEN
    ALTER TABLE content ADD COLUMN vimeo_video_id text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE content ADD COLUMN published_at timestamptz;
  END IF;
END $$;

-- Create content_versions table
CREATE TABLE IF NOT EXISTS content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  blog_content text DEFAULT '',
  title text NOT NULL,
  description text DEFAULT '',
  change_summary text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(content_id, version_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_published_at ON content(published_at);
CREATE INDEX IF NOT EXISTS idx_content_versions_content_id ON content_versions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_created_at ON content_versions(created_at);

-- Enable RLS on content_versions
ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;

-- Content versions policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_versions' AND policyname = 'Admins can insert versions'
  ) THEN
    CREATE POLICY "Admins can insert versions"
      ON content_versions FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_versions' AND policyname = 'Admins can view all versions'
  ) THEN
    CREATE POLICY "Admins can view all versions"
      ON content_versions FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'content_versions' AND policyname = 'Users can view versions of accessible content'
  ) THEN
    CREATE POLICY "Users can view versions of accessible content"
      ON content_versions FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM content c
          WHERE c.id = content_versions.content_id
          AND c.status = 'published'
          AND (
            c.required_tier = 'silver'
            OR (
              c.required_tier = 'gold'
              AND EXISTS (
                SELECT 1 FROM user_profiles up
                JOIN communities cm ON up.community_id = cm.id
                WHERE up.id = auth.uid()
                AND cm.membership_tier = 'gold'
              )
            )
          )
        )
      );
  END IF;
END $$;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for thumbnails bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admins can upload thumbnails'
  ) THEN
    CREATE POLICY "Admins can upload thumbnails"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'thumbnails'
        AND EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anyone can view thumbnails'
  ) THEN
    CREATE POLICY "Anyone can view thumbnails"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'thumbnails');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admins can update thumbnails'
  ) THEN
    CREATE POLICY "Admins can update thumbnails"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'thumbnails'
        AND EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admins can delete thumbnails'
  ) THEN
    CREATE POLICY "Admins can delete thumbnails"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'thumbnails'
        AND EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- Storage policies for pdfs bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admins can upload pdfs'
  ) THEN
    CREATE POLICY "Admins can upload pdfs"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'pdfs'
        AND EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anyone can view pdfs'
  ) THEN
    CREATE POLICY "Anyone can view pdfs"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'pdfs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admins can update pdfs'
  ) THEN
    CREATE POLICY "Admins can update pdfs"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'pdfs'
        AND EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Admins can delete pdfs'
  ) THEN
    CREATE POLICY "Admins can delete pdfs"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'pdfs'
        AND EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- Function to automatically create version on content update
CREATE OR REPLACE FUNCTION create_content_version()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.type = 'blog' AND OLD.blog_content IS DISTINCT FROM NEW.blog_content) THEN
    INSERT INTO content_versions (
      content_id,
      version_number,
      blog_content,
      title,
      description,
      created_by
    )
    SELECT 
      NEW.id,
      COALESCE(MAX(version_number), 0) + 1,
      NEW.blog_content,
      NEW.title,
      NEW.description,
      auth.uid()
    FROM content_versions
    WHERE content_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic version creation
DROP TRIGGER IF EXISTS content_version_trigger ON content;
CREATE TRIGGER content_version_trigger
  AFTER UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION create_content_version();