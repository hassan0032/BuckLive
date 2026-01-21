/*
  # Fix Function Search Paths (Corrected)

  ## Changes
  This migration sets immutable search paths for all database functions to prevent
  security issues from role-mutable search paths.

  ## Functions Updated
  - validate_access_code
  - set_invoice_no_on_insert
  - create_admin_notification_broadcast
  - log_community_tier_change
  - calculate_prorated_amount
  - create_community_notification
  - create_content_version
  - get_next_billing_date
  - gen_unique_code_for_communities
  - set_community_billing_dates
  - create_paid_user_profile
  - update_updated_at_column

  ## Security Impact
  Setting explicit search paths prevents potential SQL injection and privilege escalation attacks.
*/

-- Fix search path for validate_access_code
ALTER FUNCTION validate_access_code(p_code text) SET search_path = public, pg_temp;

-- Fix search path for set_invoice_no_on_insert
ALTER FUNCTION set_invoice_no_on_insert() SET search_path = public, pg_temp;

-- Fix search path for create_admin_notification_broadcast
ALTER FUNCTION create_admin_notification_broadcast() SET search_path = public, pg_temp;

-- Fix search path for log_community_tier_change
ALTER FUNCTION log_community_tier_change() SET search_path = public, pg_temp;

-- Fix search path for calculate_prorated_amount
ALTER FUNCTION calculate_prorated_amount(p_start_date date, p_end_date date, p_base_amount_cents integer) SET search_path = public, pg_temp;

-- Fix search path for create_community_notification
ALTER FUNCTION create_community_notification() SET search_path = public, pg_temp;

-- Fix search path for create_content_version
ALTER FUNCTION create_content_version() SET search_path = public, pg_temp;

-- Fix search path for get_next_billing_date
ALTER FUNCTION get_next_billing_date(p_billing_date date, p_from_date date) SET search_path = public, pg_temp;

-- Fix search path for gen_unique_code_for_communities
ALTER FUNCTION gen_unique_code_for_communities() SET search_path = public, pg_temp;

-- Fix search path for set_community_billing_dates
ALTER FUNCTION set_community_billing_dates() SET search_path = public, pg_temp;

-- Fix search path for create_paid_user_profile
ALTER FUNCTION create_paid_user_profile(p_user_id uuid, p_email text, p_first_name text, p_last_name text, p_stripe_customer_id text, p_subscription_id text, p_payment_tier text) SET search_path = public, pg_temp;

-- Fix search path for update_updated_at_column
ALTER FUNCTION update_updated_at_column() SET search_path = public, pg_temp;