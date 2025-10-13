/*
  # Add Communities and Access Codes System

  1. New Tables
    - `communities`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `description` (text)
      - `access_code` (text, unique, 6 characters)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Table Updates
    - Add `community_id` to `profiles` table

  3. Security
    - Enable RLS on `communities` table
    - Add policies for community management
    - Update profiles policies to include community access
*/

-- Create communities table
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  access_code text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add community_id to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'community_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN community_id uuid REFERENCES communities(id);
  END IF;
END $$;

-- Add constraint to ensure access codes are exactly 6 characters
ALTER TABLE communities ADD CONSTRAINT access_code_length CHECK (length(access_code) = 6);

-- Enable RLS on communities table
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger for communities
CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for communities
CREATE POLICY "Communities are viewable by authenticated users"
  ON communities
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage all communities"
  ON communities
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Function to validate access code during registration
CREATE OR REPLACE FUNCTION validate_access_code(code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  community_id uuid;
BEGIN
  SELECT id INTO community_id
  FROM communities
  WHERE access_code = code AND is_active = true;
  
  RETURN community_id;
END;
$$;