/*
  # Fix Content RLS Policies - Remove Circular Dependencies

  ## Problem
  The content policies were querying user_profiles within the policies,
  which could trigger circular RLS checks and break content visibility.

  ## Solution
  Use helper functions to check user roles without triggering RLS on user_profiles.
  Simplify the tier-based access logic.

  ## Policies Fixed
  - Admin content policies
  - User content view policies based on tier
  - Gold content access policy

  ## Security
  Maintains same security posture while eliminating circular dependencies.
*/

-- Admin policies for content
DROP POLICY IF EXISTS "Admins can delete content" ON content;
CREATE POLICY "Admins can delete content"
  ON content FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert content" ON content;
CREATE POLICY "Admins can insert content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update content" ON content;
CREATE POLICY "Admins can update content"
  ON content FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can view all content" ON content;
CREATE POLICY "Admins can view all content"
  ON content FOR SELECT
  TO authenticated
  USING (is_admin());

-- Users can view silver content (all tiers can access silver)
DROP POLICY IF EXISTS "Users can view silver content" ON content;
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

-- Gold content restricted to Gold members and special roles
DROP POLICY IF EXISTS "Gold content restricted to Gold members and Admins" ON content;
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

-- General content viewing for managers
DROP POLICY IF EXISTS "Users can view content based on role and tier" ON content;
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
