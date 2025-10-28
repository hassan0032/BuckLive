-- Add shared account feature
-- This migration adds support for shared accounts that multiple users can use
-- with the same credentials, but cannot modify their own profile or reset password

-- Add is_shared_account column to user_profiles table
ALTER TABLE user_profiles ADD COLUMN is_shared_account boolean DEFAULT false NOT NULL;

-- Update RLS policy to prevent shared accounts from updating their own profile
CREATE POLICY "Shared accounts cannot update their own profile"
ON user_profiles FOR UPDATE
USING (
  auth.uid() = id AND is_shared_account = false
);

-- Add comment to explain the column
COMMENT ON COLUMN user_profiles.is_shared_account IS 'Indicates if this is a shared account that multiple users can use with the same credentials. Shared accounts cannot modify their profile or reset their password.';
