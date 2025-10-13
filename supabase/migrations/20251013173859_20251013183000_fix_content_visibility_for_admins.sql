/*
  # Fix Content Visibility for Admins

  ## Overview
  This migration updates the content viewing policy to allow admins to view all content regardless of tier or community membership.

  ## Changes
  - Drops the existing "Users can view content based on their tier" policy
  - Creates a new policy that allows:
    1. Admins to view all content
    2. Regular users to view content based on their community's tier

  ## Security
  - Maintains tier-based access for regular users
  - Grants full content visibility to admins
  - Users without a community can only see silver tier content
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view content based on their tier" ON content;

-- Create new policy that allows admins to view all content
CREATE POLICY "Users can view content based on role and tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all content
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    -- Regular users see content based on their tier
    (
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
    )
  );