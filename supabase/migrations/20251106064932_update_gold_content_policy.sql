/*
  # Update Gold Content Policy

  ## Overview
  This migration updates the "Gold members can view gold content" policy to allow
  both gold and silver tier members to view gold content.

  ## Changes
  - Updates the USING clause to check if user's community tier is either 'gold' or 'silver'
  - Previously only gold tier members could view gold content
  - Now silver tier members can also view gold content

  ## Security
  - Maintains tier-based access control
  - Only applies to gold tier content
  - Users must still have gold or silver tier membership
*/

DROP POLICY IF EXISTS "Gold members can view gold content" ON public.content;

CREATE POLICY "Gold members can view gold content"
ON public.content
TO authenticated
USING (
  (required_tier = 'gold'::text)
  AND (
    public.get_user_community_tier(auth.uid()) = 'gold'::text
    OR public.get_user_community_tier(auth.uid()) = 'silver'::text
  )
);

