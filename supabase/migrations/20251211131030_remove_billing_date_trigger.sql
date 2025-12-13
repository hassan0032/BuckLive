-- Migration: Remove billing_date-on-first-login trigger and function

-- Drop the trigger that set billing_date on user_sessions insert
DROP TRIGGER IF EXISTS set_billing_date_trigger ON public.user_sessions;

-- Drop the function that was used by the trigger
DROP FUNCTION IF EXISTS public.set_billing_date_on_first_login();

-- Note: This migration intentionally leaves the `billing_date` column in place.
-- Billing dates will now be set explicitly by the server-side functions and client code.
