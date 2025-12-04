DROP POLICY IF EXISTS "Gold members can view gold content" ON content;
DROP POLICY IF EXISTS "Gold content restricted to Gold members and Admins" ON content;

CREATE POLICY "Gold content restricted to Gold members and Admins"
ON content
FOR SELECT
TO authenticated
USING (
  required_tier = 'gold' AND (
    auth.uid() IS NOT NULL AND (
      -- Allow Admins and Community Managers
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'community_manager')
      )
      OR
      -- Allow Members of Gold Communities
      EXISTS (
        SELECT 1 
        FROM user_profiles up
        JOIN communities c ON up.community_id = c.id
        WHERE up.id = auth.uid() 
        AND c.membership_tier = 'gold'
      )
    )
  )
);