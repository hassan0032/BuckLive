/*
  # Update Tier Function for Individual Payment Support

  ## Overview
  Updates the get_user_community_tier function to check for individual payment tier
  in addition to community-based membership tier. This enables users who self-register
  with payment to have proper content access.

  ## Changes
  1. Update get_user_community_tier to check payment_tier field
  2. Prioritize individual payment tier over community tier
  3. Check subscription_status to ensure tier is active
  
  ## Logic
  - If user has payment_tier and subscription_status is 'active', return payment_tier
  - Otherwise, fall back to community membership_tier
  - Default to 'silver' if no tier found
*/

-- Update the get_user_community_tier function to support individual payments
CREATE OR REPLACE FUNCTION public.get_user_community_tier(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off
AS $$
DECLARE
  tier text;
  payment_tier text;
  sub_status text;
  community_tier text;
BEGIN
  -- First check for individual payment tier
  SELECT 
    up.payment_tier,
    up.subscription_status,
    c.membership_tier
  INTO payment_tier, sub_status, community_tier
  FROM public.user_profiles up
  LEFT JOIN public.communities c ON up.community_id = c.id
  WHERE up.id = user_id
  LIMIT 1;
  
  -- Priority 1: Individual payment tier (if active subscription)
  IF payment_tier IS NOT NULL AND sub_status = 'active' THEN
    RETURN payment_tier;
  END IF;
  
  -- Priority 2: Community membership tier
  IF community_tier IS NOT NULL THEN
    RETURN community_tier;
  END IF;
  
  -- Default: silver tier
  RETURN 'silver';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'silver';
END;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.get_user_community_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_community_tier(uuid) TO anon;