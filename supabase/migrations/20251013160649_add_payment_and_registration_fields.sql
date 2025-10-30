/*
  # Add Payment and Registration Type Fields

  ## Overview
  This migration adds payment processing and registration tracking capabilities to support dual registration paths:
  1. Access code-based registration (existing community members)
  2. Self-registration with Stripe payment (individual users)

  ## Table Updates

  ### user_profiles table additions
  - `registration_type` (text) - Either 'access_code' or 'self_registered'
  - `stripe_customer_id` (text) - Stripe customer identifier for payment tracking
  - `subscription_status` (text) - Current subscription status: 'active', 'canceled', 'past_due', 'trialing'
  - `subscription_id` (text) - Stripe subscription identifier
  - `payment_tier` (text) - User's payment tier: 'silver' or 'gold' (for self-registered users)
  - `subscription_started_at` (timestamptz) - When subscription began
  - `subscription_ends_at` (timestamptz) - When subscription ends/renews

  ### New payments table
  Tracks all payment transactions for audit and billing history.
  - `id` (uuid, primary key) - Unique payment record identifier
  - `user_id` (uuid, references user_profiles) - User who made the payment
  - `amount` (numeric) - Payment amount in cents
  - `currency` (text) - Payment currency (default: 'usd')
  - `status` (text) - Payment status: 'succeeded', 'pending', 'failed', 'refunded'
  - `stripe_payment_intent_id` (text) - Stripe payment intent identifier
  - `stripe_invoice_id` (text) - Stripe invoice identifier
  - `description` (text) - Payment description
  - `metadata` (jsonb) - Additional payment metadata
  - `created_at` (timestamptz) - Payment timestamp

  ## Security

  ### payments table
  - RLS enabled
  - Users can view their own payment history
  - Admins can view all payments

  ## Indexes
  - user_profiles: stripe_customer_id for fast Stripe lookups
  - payments: user_id for efficient payment history queries
  - payments: stripe_payment_intent_id for webhook processing
*/

-- Add payment and registration fields to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'registration_type'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN registration_type text DEFAULT 'access_code' CHECK (registration_type IN ('access_code', 'self_registered'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_status text CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'payment_tier'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN payment_tier text CHECK (payment_tier IN ('silver', 'gold'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_started_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'subscription_ends_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN subscription_ends_at timestamptz;
  END IF;

END
$$;

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text DEFAULT 'usd',
  status text NOT NULL CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded')),
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  description text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);

-- Enable RLS on payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Payments policies
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to create user profile after successful payment
CREATE OR REPLACE FUNCTION create_paid_user_profile(
  p_user_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_stripe_customer_id text,
  p_subscription_id text,
  p_payment_tier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_profiles (
    id,
    email,
    first_name,
    last_name,
    registration_type,
    stripe_customer_id,
    subscription_id,
    subscription_status,
    payment_tier,
    subscription_started_at,
    role
  ) VALUES (
    p_user_id,
    p_email,
    p_first_name,
    p_last_name,
    'self_registered',
    p_stripe_customer_id,
    p_subscription_id,
    'active',
    p_payment_tier,
    now(),
    'member'
  )
  ON CONFLICT (id) DO UPDATE SET
    stripe_customer_id = p_stripe_customer_id,
    subscription_id = p_subscription_id,
    subscription_status = 'active',
    payment_tier = p_payment_tier,
    subscription_started_at = now();
END
$$;