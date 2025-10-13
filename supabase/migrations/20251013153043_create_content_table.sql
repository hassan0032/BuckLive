/*
  # Create Content Table

  ## Overview
  This migration creates the content library table for storing videos, PDFs, and blog posts with tiered access control.

  ## New Tables
  
  ### content
  Stores all content items available in the platform.
  - `id` (uuid, primary key) - Unique identifier
  - `title` (text) - Content title
  - `description` (text) - Content description
  - `type` (text) - Content type: 'video', 'pdf', or 'blog'
  - `url` (text) - URL to the content resource
  - `thumbnail_url` (text) - URL to thumbnail image
  - `tags` (text[]) - Array of tags for categorization
  - `category` (text) - Content category
  - `required_tier` (text) - Minimum tier required: 'silver' or 'gold'
  - `author` (text) - Content author name
  - `duration` (integer) - Duration in seconds (for videos)
  - `file_size` (bigint) - File size in bytes (for PDFs)
  - `created_at` (timestamptz) - When content was created
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  
  ### content table
  - RLS enabled
  - Users can view content based on their community's membership tier
  - Only admins can create, update, or delete content

  ## Indexes
  - category for filtering by category
  - required_tier for tier-based queries
  - tags using GIN index for efficient tag searches
*/

-- Create content table
CREATE TABLE IF NOT EXISTS content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL CHECK (type IN ('video', 'pdf', 'blog')),
  url text NOT NULL,
  thumbnail_url text DEFAULT '',
  tags text[] DEFAULT ARRAY[]::text[],
  category text NOT NULL DEFAULT '',
  required_tier text NOT NULL CHECK (required_tier IN ('silver', 'gold')),
  author text NOT NULL DEFAULT '',
  duration integer DEFAULT 0,
  file_size bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);
CREATE INDEX IF NOT EXISTS idx_content_tier ON content(required_tier);
CREATE INDEX IF NOT EXISTS idx_content_tags ON content USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);

-- Enable RLS
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Content policies
CREATE POLICY "Users can view content based on their tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    CASE 
      WHEN required_tier = 'silver' THEN true
      WHEN required_tier = 'gold' THEN
        EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN communities c ON up.community_id = c.id
          WHERE up.id = auth.uid()
          AND c.membership_tier = 'gold'
        )
    END
  );

CREATE POLICY "Admins can insert content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update content"
  ON content FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete content"
  ON content FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();