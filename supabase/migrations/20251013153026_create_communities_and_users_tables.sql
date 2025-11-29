/*
  # Create Communities and Users Tables

  ## Overview
  This migration sets up the core database structure for a community-based content platform with tiered membership access.

  ## New Tables
  
  ### 1. communities
  Stores information about each community organization.
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Community name
  - `description` (text) - Community description
  - `access_code` (text, unique) - Code for joining the community
  - `is_active` (boolean) - Whether community is active (default: true)
  - `membership_tier` (text) - Either 'silver' or 'gold'
  - `created_at` (timestamptz) - When community was created
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. user_profiles
  Extends Supabase auth.users with additional profile information.
  - `id` (uuid, primary key, references auth.users)
  - `email` (text) - User email
  - `first_name` (text) - User's first name
  - `last_name` (text) - User's last name
  - `avatar_url` (text) - URL to profile picture
  - `role` (text) - Either 'member' or 'admin' (default: 'member')
  - `community_id` (uuid, references communities) - Associated community
  - `created_at` (timestamptz) - When profile was created
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  
  ### communities table
  - RLS enabled
  - Authenticated users can view active communities
  - Only admins can create/update/delete communities
  
  ### user_profiles table
  - RLS enabled
  - Users can view their own profile and profiles in their community
  - Users can update their own profile
  - Admins can view and update all profiles

  ## Indexes
  - communities: access_code for fast lookups
  - user_profiles: community_id for efficient community member queries
*/

-- Create communities table
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  access_code text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  membership_tier text NOT NULL CHECK (membership_tier IN ('silver', 'gold')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text DEFAULT '',
  last_name text DEFAULT '',
  avatar_url text DEFAULT '',
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  community_id uuid REFERENCES communities(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_communities_access_code ON communities(access_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_community_id ON user_profiles(community_id);

-- Enable RLS
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Communities policies
CREATE POLICY "Authenticated users can view active communities"
  ON communities FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update communities"
  ON communities FOR UPDATE
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

CREATE POLICY "Admins can delete communities"
  ON communities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- User profiles policies
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view profiles in their community"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
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

-- Update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS update_communities_updated_at ON communities;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Create triggers for updated_at
CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();