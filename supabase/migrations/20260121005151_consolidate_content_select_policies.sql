/*
  # Consolidate Content SELECT Policies

  ## Problem
  Multiple overlapping SELECT policies on the content table are causing confusion and
  potentially conflicting with each other:
  - "Admins can view all content"
  - "Gold content restricted to Gold members and Admins"
  - "Users can view silver content"
  - "Users can view content based on role and tier"

  ## Solution
  Remove all SELECT policies and create a single comprehensive policy that handles
  all access scenarios:
  - Admins can view all published content
  - Community managers can view all published content
  - Organization managers can view all published content
  - Members can view silver content if in silver or gold communities
  - Members can view gold content only if in gold communities

  ## Security
  Maintains the same security posture with clearer logic and better performance.
*/

-- Drop all existing SELECT policies on content
DROP POLICY IF EXISTS "Admins can view all content" ON content;
DROP POLICY IF EXISTS "Gold content restricted to Gold members and Admins" ON content;
DROP POLICY IF EXISTS "Users can view silver content" ON content;
DROP POLICY IF EXISTS "Users can view content based on role and tier" ON content;

-- Create single comprehensive SELECT policy
CREATE POLICY "Content visibility based on role and tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    status = 'published' AND (
      -- Admins, community managers, and org managers can see all content
      is_admin() OR 
      is_community_manager() OR 
      is_organization_manager() OR
      -- Members can see silver content if they're in any community
      (
        required_tier = 'silver' AND
        EXISTS (
          SELECT 1 FROM communities c
          WHERE c.id = current_user_community_id()
          AND c.membership_tier IN ('silver', 'gold')
        )
      ) OR
      -- Members can see gold content only if in a gold community
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
