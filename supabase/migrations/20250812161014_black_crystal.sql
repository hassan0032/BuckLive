/*
  # Create membership site database schema

  1. New Tables
    - `profiles` - Extended user profile information
    - `content` - Videos, PDFs, and blog posts with metadata
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users and admin access
    - Profiles can be read by authenticated users, updated by owners
    - Content can be read by authenticated users, managed by admins
  
  3. Functions
    - Trigger to create profile on user signup
    - Admin role management
*/

-- Create profiles table for extended user information
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  avatar_url text,
  role text DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create content table for videos, PDFs, and blog posts
CREATE TABLE IF NOT EXISTS content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL CHECK (type IN ('video', 'pdf', 'blog')),
  url text NOT NULL,
  thumbnail_url text,
  tags text[] DEFAULT '{}',
  category text NOT NULL,
  author text NOT NULL,
  duration integer, -- for videos in seconds
  file_size bigint, -- for PDFs in bytes
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Content policies
CREATE POLICY "Content is viewable by authenticated users"
  ON content
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage all content"
  ON content
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample content
INSERT INTO content (title, description, type, url, thumbnail_url, tags, category, author, duration) VALUES
('Introduction to React Hooks', 'Learn the fundamentals of React Hooks and how to use them effectively in your applications.', 'video', 'https://example.com/react-hooks-video', 'https://images.pexels.com/photos/11035380/pexels-photo-11035380.jpeg?auto=compress&cs=tinysrgb&w=500', ARRAY['react', 'javascript', 'hooks'], 'Web Development', 'John Smith', 1800),
('Advanced TypeScript Patterns', 'Deep dive into advanced TypeScript patterns and best practices for large-scale applications.', 'pdf', 'https://example.com/typescript-patterns.pdf', 'https://images.pexels.com/photos/4164418/pexels-photo-4164418.jpeg?auto=compress&cs=tinysrgb&w=500', ARRAY['typescript', 'patterns', 'advanced'], 'Programming', 'Sarah Johnson', NULL),
('Building Scalable APIs', 'A comprehensive guide to designing and building scalable REST APIs with Node.js and Express.', 'blog', 'https://example.com/scalable-apis-blog', 'https://images.pexels.com/photos/1181677/pexels-photo-1181677.jpeg?auto=compress&cs=tinysrgb&w=500', ARRAY['api', 'nodejs', 'express'], 'Backend Development', 'Mike Chen', NULL),
('CSS Grid Masterclass', 'Master CSS Grid layout with practical examples and real-world projects.', 'video', 'https://example.com/css-grid-video', 'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=500', ARRAY['css', 'grid', 'layout'], 'Web Development', 'Emily Davis', 2400),
('Database Design Principles', 'Essential principles and best practices for designing efficient and scalable databases.', 'pdf', 'https://example.com/database-design.pdf', 'https://images.pexels.com/photos/1181298/pexels-photo-1181298.jpeg?auto=compress&cs=tinysrgb&w=500', ARRAY['database', 'design', 'sql'], 'Database', 'Robert Wilson', NULL),
('Modern JavaScript Features', 'Explore the latest JavaScript features and how to use them in modern web development.', 'blog', 'https://example.com/modern-js-blog', 'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=500', ARRAY['javascript', 'es6', 'modern'], 'Programming', 'Lisa Anderson', NULL);