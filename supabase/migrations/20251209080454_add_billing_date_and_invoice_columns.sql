-- Migration: Add billing_date to user_profiles and new columns to invoices
-- Also adds trigger to set billing_date on first login for community managers

-- ============================================================================
-- STEP 1: Add billing_date column to user_profiles
-- ============================================================================
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS billing_date DATE;

COMMENT ON COLUMN public.user_profiles.billing_date IS 'The annual billing anchor date for community managers. Set on their first login.';

-- ============================================================================
-- STEP 2: Add new columns to invoices table
-- ============================================================================

-- Add community_manager_email
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS community_manager_email TEXT;

COMMENT ON COLUMN public.invoices.community_manager_email IS 'Email of the community manager at the time of invoice creation.';

-- Add community_manager_name
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS community_manager_name TEXT;

COMMENT ON COLUMN public.invoices.community_manager_name IS 'Name of the community manager at the time of invoice creation.';

-- Add full_year_amount_cents (base yearly amount before proration)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS full_year_amount_cents INTEGER;

COMMENT ON COLUMN public.invoices.full_year_amount_cents IS 'The base yearly amount in cents before any proration is applied. Silver = 250000 ($2500), Gold = 500000 ($5000).';

-- Add prorated_days (number of days in prorated period)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS prorated_days INTEGER;

COMMENT ON COLUMN public.invoices.prorated_days IS 'Number of days in the prorated billing period. NULL or 365 for full year invoices.';

-- Add is_prorated flag
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS is_prorated BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.invoices.is_prorated IS 'Flag indicating if this invoice is prorated (partial year).';

-- Add updated_at
-- ALTER TABLE public.invoices
-- ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- COMMENT ON COLUMN public.invoices.updated_at IS 'Timestamp of last update to the invoice record.';

-- ============================================================================
-- STEP 3: Create trigger to update updated_at on invoices
-- ============================================================================
-- CREATE OR REPLACE FUNCTION public.update_invoices_updated_at()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   NEW.updated_at = now();
--   RETURN NEW;
-- END;
-- $$;

-- DROP TRIGGER IF EXISTS update_invoices_updated_at_trigger ON public.invoices;

-- CREATE TRIGGER update_invoices_updated_at_trigger
--   BEFORE UPDATE ON public.invoices
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_invoices_updated_at();

-- ============================================================================
-- STEP 4: Create function to set billing_date for community managers on first login
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_billing_date_on_first_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_billing_date DATE;
BEGIN
  -- Get the user's role and current billing_date
  SELECT role, billing_date INTO v_role, v_billing_date
  FROM public.user_profiles
  WHERE id = NEW.user_id;

  -- Only set billing_date if:
  -- 1. User is a community_manager
  -- 2. billing_date is currently NULL
  IF v_role = 'community_manager' AND v_billing_date IS NULL THEN
    UPDATE public.user_profiles
    SET billing_date = CURRENT_DATE
    WHERE id = NEW.user_id;

    RAISE LOG 'Set billing_date to % for community manager %', CURRENT_DATE, NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 5: Create trigger on user_sessions to set billing_date on first login
-- ============================================================================
DROP TRIGGER IF EXISTS set_billing_date_trigger ON public.user_sessions;

CREATE TRIGGER set_billing_date_trigger
  AFTER INSERT ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_billing_date_on_first_login();

-- ============================================================================
-- STEP 6: Create PostgreSQL function to calculate prorated amount
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_prorated_amount(
  p_start_date DATE,
  p_end_date DATE,
  p_base_amount_cents INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_days INTEGER;
  v_prorated_amount INTEGER;
BEGIN
  -- Calculate the number of days in the period
  v_days := p_end_date - p_start_date;
  
  -- Calculate prorated amount: (days / 365) * base_amount
  v_prorated_amount := ROUND((v_days::NUMERIC / 365.0) * p_base_amount_cents);
  
  RETURN v_prorated_amount;
END;
$$;

COMMENT ON FUNCTION public.calculate_prorated_amount IS 'Calculates prorated invoice amount based on number of days. Returns amount in cents.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_prorated_amount(DATE, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_prorated_amount(DATE, DATE, INTEGER) TO service_role;

-- ============================================================================
-- STEP 7: Create helper function to get next billing date occurrence
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_next_billing_date(
  p_billing_date DATE,
  p_from_date DATE DEFAULT CURRENT_DATE
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_month INTEGER;
  v_day INTEGER;
  v_year INTEGER;
  v_next_date DATE;
BEGIN
  -- Extract month and day from billing_date
  v_month := EXTRACT(MONTH FROM p_billing_date);
  v_day := EXTRACT(DAY FROM p_billing_date);
  v_year := EXTRACT(YEAR FROM p_from_date);
  
  -- Try to construct date in current year
  BEGIN
    v_next_date := make_date(v_year, v_month, v_day);
  EXCEPTION WHEN OTHERS THEN
    -- Handle Feb 29 on non-leap years by using Feb 28
    v_next_date := make_date(v_year, v_month, 28);
  END;
  
  -- If the date has already passed this year, use next year
  IF v_next_date <= p_from_date THEN
    v_year := v_year + 1;
    BEGIN
      v_next_date := make_date(v_year, v_month, v_day);
    EXCEPTION WHEN OTHERS THEN
      v_next_date := make_date(v_year, v_month, 28);
    END;
  END IF;
  
  RETURN v_next_date;
END;
$$;

COMMENT ON FUNCTION public.get_next_billing_date IS 'Returns the next occurrence of the billing date (same month/day) from the given date.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_next_billing_date(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_billing_date(DATE, DATE) TO service_role;

