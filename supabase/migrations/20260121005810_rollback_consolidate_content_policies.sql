/*
  # Rollback: Restore Original Content Policies

  ## Changes
  This migration rolls back the consolidation of content SELECT policies,
  restoring the original multiple policies that existed before.
*/

-- Drop the consolidated policy
DROP POLICY IF EXISTS "Content visibility based on role and tier" ON content;

-- Restore original policies
CREATE POLICY "Admins can view all content"
  ON content FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Users can view silver content"
  ON content FOR SELECT
  TO authenticated
  USING (
    required_tier = 'silver' AND
    status = 'published' AND
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = current_user_community_id()
      AND c.membership_tier IN ('silver', 'gold')
    )
  );

CREATE POLICY "Gold content restricted to Gold members and Admins"
  ON content FOR SELECT
  TO authenticated
  USING (
    required_tier = 'gold' AND
    status = 'published' AND
    (
      is_admin() OR
      is_organization_manager() OR
      EXISTS (
        SELECT 1 FROM communities c
        WHERE c.id = current_user_community_id()
        AND c.membership_tier = 'gold'
      )
    )
  );

CREATE POLICY "Users can view content based on role and tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    status = 'published' AND
    (
      is_admin() OR
      is_community_manager() OR
      is_organization_manager() OR
      (
        required_tier = 'silver' AND
        EXISTS (
          SELECT 1 FROM communities c
          WHERE c.id = current_user_community_id()
          AND c.membership_tier IN ('silver', 'gold')
        )
      ) OR
      (
        required_tier = 'gold' AND
        EXISTS (
          SELECT 1 FROM communities c
          WHERE c.id = current_user_community_id()
          AND c.membership_tier = 'gold'
        )
      )
    )
  );
