-- Add is_manager_only column to content table
ALTER TABLE content
ADD COLUMN IF NOT EXISTS is_manager_only BOOLEAN DEFAULT false;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS content_is_manager_only_idx ON content(is_manager_only);

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view content based on role and tier" ON content;

-- Create the new policy
CREATE POLICY "Users can view content based on role and tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    status = 'published' AND (
      -- Admins, Organization Managers, and Community Managers can see all content
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'organization_manager', 'community_manager')
      )
      OR
      -- Regular users can see content based on their community's membership tier and if it is not manager only
      (
        is_manager_only = false AND
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
    )
  );