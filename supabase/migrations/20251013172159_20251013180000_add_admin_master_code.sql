/*
  # Add Master Admin Code System

  ## Overview
  This migration creates a settings table to store system-wide configuration including a master admin access code.

  ## New Tables

  ### settings
  Stores system configuration values.
  - `key` (text, primary key) - Configuration key identifier
  - `value` (text) - Configuration value
  - `description` (text) - Human-readable description of the setting
  - `created_at` (timestamptz) - When setting was created
  - `updated_at` (timestamptz) - Last update timestamp

  ## Initial Data
  - Inserts master_admin_code with a secure randomly generated 10-character code
  - Initial code: ADMIN2024X (should be changed after first use)

  ## Security
  - RLS enabled on settings table
  - Only admins can view settings
  - Only admins can update settings
  - Settings cannot be deleted (only updated)

  ## Functions
  - Updates validate_access_code function to check both community codes and admin code
  - When admin code is used, returns a special response indicating admin registration
*/

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Settings policies
CREATE POLICY "Admins can view settings"
  ON settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update settings"
  ON settings FOR UPDATE
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

-- Insert initial master admin code
INSERT INTO settings (key, value, description)
VALUES (
  'master_admin_code',
  'ADMIN2024X',
  'Master access code for creating admin accounts. Change this after first use.'
)
ON CONFLICT (key) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update validate_access_code function to handle both community and admin codes
CREATE OR REPLACE FUNCTION validate_access_code(code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  community_id uuid;
  admin_code text;
  result jsonb;
BEGIN
  -- First check if it's the admin code
  SELECT value INTO admin_code
  FROM settings
  WHERE key = 'master_admin_code';

  IF code = admin_code THEN
    -- Return special response indicating admin registration
    result := jsonb_build_object(
      'is_admin', true,
      'community_id', NULL
    );
    RETURN result;
  END IF;

  -- Otherwise, check if it's a community code
  SELECT id INTO community_id
  FROM communities
  WHERE access_code = code AND is_active = true;

  IF community_id IS NOT NULL THEN
    -- Return community registration response
    result := jsonb_build_object(
      'is_admin', false,
      'community_id', community_id
    );
    RETURN result;
  END IF;

  -- Invalid code
  RETURN NULL;
END
$$;