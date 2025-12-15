-- Migration: remove_organization_billing_date

-- 1. Drop the dependent view
DROP VIEW IF EXISTS public.users_with_details;

-- 2. Remove billing_date from organizations
ALTER TABLE public.organizations
DROP COLUMN IF EXISTS billing_date;

-- 3. Recreate the view without organization_billing_date
CREATE OR REPLACE VIEW public.users_with_details AS
WITH all_users AS (
  -- Part 1: Members (users who have community_id set in user_profiles)
  SELECT 
    up.id,
    up.email,
    up.first_name,
    up.last_name,
    up.avatar_url,
    up.role,
    up.registration_type,
    up.subscription_status,
    up.payment_tier,
    up.is_shared_account,
    up.created_at,
    up.updated_at,
    up.billing_date,
    c.id AS community_id,
    c.name AS community_name,
    c.membership_tier AS community_tier,
    c.organization_id,
    org.name AS organization_name
    -- Removed organization_billing_date
  FROM user_profiles up
  JOIN communities c ON up.community_id = c.id
  LEFT JOIN organizations org ON c.organization_id = org.id

  UNION

  -- Part 2: Community Managers (from community_managers junction)
  SELECT 
    up.id,
    up.email,
    up.first_name,
    up.last_name,
    up.avatar_url,
    up.role,
    up.registration_type,
    up.subscription_status,
    up.payment_tier,
    up.is_shared_account,
    up.created_at,
    up.updated_at,
    up.billing_date,
    c.id AS community_id,
    c.name AS community_name,
    c.membership_tier AS community_tier,
    c.organization_id,
    org.name AS organization_name
    -- Removed organization_billing_date
  FROM user_profiles up
  JOIN community_managers cm ON up.id = cm.user_id
  JOIN communities c ON cm.community_id = c.id
  LEFT JOIN organizations org ON c.organization_id = org.id
  WHERE up.role = 'community_manager'
)
SELECT * 
FROM all_users
WHERE 
  -- Policy: Organization Managers can see users in their organization
  (organization_id IN (
    SELECT organization_id 
    FROM organization_managers 
    WHERE user_id = auth.uid()
  ))
  OR
  -- Policy: Admins can see everything
  (EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ));

ALTER VIEW users_with_details SET (security_invoker = off);
