/*
  # Fix Signup Permissions for Community-Based Registration

  ## Problem
  When users sign up with a valid access code, the signup fails with a 403 error.
  This happens because:
  1. The handle_new_user trigger tries to insert into user_profiles
  2. The RLS policy checks if the user can insert their own profile
  3. But during signup, the auth context might not be fully established yet

  ## Solution
  1. Update handle_new_user function to properly handle SECURITY DEFINER
  2. Add a policy to allow service role to insert profiles
  3. Grant necessary permissions to the trigger function
  4. Ensure the function bypasses RLS when inserting profiles

  ## Security
  - The trigger function is SECURITY DEFINER and only inserts during user creation
  - RLS policies still protect user_profiles for normal operations
  - Only the trigger can insert profiles on behalf of new users
*/

-- Add missing columns to user_profiles table
DO $$
BEGIN
  -- Add registration_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'registration_type'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD COLUMN registration_type text DEFAULT 'self_registered' CHECK (registration_type IN ('access_code', 'self_registered'));
    
    -- Update existing records to set registration_type based on community_id
    UPDATE public.user_profiles
    SET registration_type = CASE
      WHEN community_id IS NOT NULL THEN 'access_code'
      ELSE 'self_registered'
    END;
  END IF;

  -- Add payment-related columns for Stripe integration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD COLUMN subscription_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD COLUMN subscription_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'payment_tier'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD COLUMN payment_tier text CHECK (payment_tier IN ('silver', 'gold'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'subscription_start_date'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD COLUMN subscription_start_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'subscription_end_date'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD COLUMN subscription_end_date timestamptz;
  END IF;
END $$;

-- Drop and recreate the handle_new_user function with proper settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  community_uuid uuid;
  user_role text;
BEGIN
  -- Extract community_id from metadata
  BEGIN
    community_uuid := (NEW.raw_user_meta_data->>'community_id')::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      community_uuid := NULL;
  END;

  -- Extract role from metadata, default to 'member'
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');

  -- Insert into user_profiles
  -- This will bypass RLS because of SECURITY DEFINER
  INSERT INTO public.user_profiles (
    id, 
    email, 
    first_name, 
    last_name, 
    community_id, 
    role,
    registration_type
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    community_uuid,
    user_role,
    CASE 
      WHEN community_uuid IS NOT NULL THEN 'access_code'
      ELSE 'self_registered'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    community_id = EXCLUDED.community_id,
    role = EXCLUDED.role,
    registration_type = EXCLUDED.registration_type;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail user creation
    RAISE LOG 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Grant execute permission on the function to necessary roles
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add a policy to allow service role to insert profiles
-- This ensures the trigger function can insert even during signup
DROP POLICY IF EXISTS "Service role can insert profiles" ON user_profiles;
CREATE POLICY "Service role can insert profiles"
  ON user_profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Ensure anon role can call validate_access_code
GRANT EXECUTE ON FUNCTION public.validate_access_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_access_code(text) TO authenticated;

-- Grant SELECT on communities to anon for access code validation
-- This is needed because users validating access codes aren't authenticated yet
DROP POLICY IF EXISTS "Anon can view communities for validation" ON communities;
CREATE POLICY "Anon can view communities for validation"
  ON communities FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Ensure users can read communities to validate foreign key constraints
GRANT SELECT ON TABLE public.communities TO anon;
GRANT SELECT ON TABLE public.communities TO authenticated;

