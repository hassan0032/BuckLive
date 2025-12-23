-- Allow Organization Managers to view all content (like Admins)
-- Update the content SELECT policy to include Organization Managers

DROP POLICY IF EXISTS "Users can view content based on their tier" ON content;

CREATE POLICY "Users can view content based on role and tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    -- Organization Managers and Admins can see all content
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'organization_manager')
    )
    OR
    -- Regular users can see content based on their community's membership tier
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
