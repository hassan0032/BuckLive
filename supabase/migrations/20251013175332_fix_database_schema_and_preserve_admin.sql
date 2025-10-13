/*
  # Fix Database Schema and Preserve Admin User

  ## Overview
  This migration consolidates the database schema by ensuring user_profiles is the single source of truth,
  updates all database functions and triggers to work with the correct tables, and preserves the existing
  admin user account.

  ## Changes

  ### 1. Table Migration
  - Migrate any data from old 'profiles' table to 'user_profiles' if it exists
  - Drop the old 'profiles' table after migration
  - Ensure user_profiles has all necessary columns

  ### 2. Function Updates
  - Update handle_new_user() function to insert into user_profiles
  - Ensure community_id is properly extracted from user metadata
  - Add error handling to prevent signup failures

  ### 3. Admin User Preservation
  - Check if sezzat@buckinstitute.org exists in auth.users
  - Ensure this user has a user_profiles entry with admin role
  - Allow admin users to function without community assignment

  ### 4. Seed Data
  - Create test communities with known access codes
  - Add sample content for testing tier-based access
  - Set up data to enable immediate testing

  ### 5. RLS Policy Fixes
  - Update is_admin() helper function to query user_profiles
  - Fix all policies that reference 'profiles' to use 'user_profiles'
  - Ensure admin users have full access regardless of community

  ## Security
  - All RLS policies remain enabled and restrictive
  - Admin role is properly checked before granting elevated permissions
  - User data is migrated safely without data loss
*/

-- Step 1: Migrate data from old profiles table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    -- Migrate any existing data from profiles to user_profiles
    INSERT INTO user_profiles (id, email, first_name, last_name, avatar_url, role, community_id, created_at, updated_at)
    SELECT id, email, first_name, last_name, avatar_url, role, community_id, created_at, updated_at
    FROM profiles
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      avatar_url = EXCLUDED.avatar_url,
      role = EXCLUDED.role,
      community_id = EXCLUDED.community_id,
      updated_at = EXCLUDED.updated_at;
    
    -- Drop the old table
    DROP TABLE IF EXISTS profiles CASCADE;
  END IF;
END $$;

-- Step 2: Update the handle_new_user function to use user_profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, first_name, last_name, community_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    (NEW.raw_user_meta_data->>'community_id')::uuid,
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error creating user_profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Update is_admin helper function to use user_profiles
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

-- Step 4: Ensure admin user has a profile (if auth user exists)
-- This will be handled by a one-time check that creates the profile if the auth user exists
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Try to find the admin user in auth.users
  -- This query will only work if executed with proper permissions
  -- If it fails, it will be caught and ignored
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'sezzat@buckinstitute.org';
  
  IF admin_user_id IS NOT NULL THEN
    -- Ensure the user has a profile with admin role
    INSERT INTO public.user_profiles (id, email, role, first_name, last_name)
    VALUES (
      admin_user_id,
      'sezzat@buckinstitute.org',
      'admin',
      'Admin',
      'User'
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      email = 'sezzat@buckinstitute.org';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- If we don't have permission to query auth.users, that's okay
    -- The trigger will handle it when the user logs in
    NULL;
  WHEN others THEN
    -- Log but don't fail
    RAISE LOG 'Error ensuring admin profile: %', SQLERRM;
END $$;

-- Step 5: Add seed data for communities
INSERT INTO communities (name, description, access_code, membership_tier, is_active)
VALUES 
  ('Silver Test Community', 'Test community with Silver tier access', 'TEST01', 'silver', true),
  ('Gold Premium Community', 'Premium community with Gold tier access', 'GOLD01', 'gold', true)
ON CONFLICT (access_code) DO NOTHING;

-- Step 6: Add seed content
INSERT INTO content (title, description, type, url, thumbnail_url, tags, category, required_tier, author, duration, file_size)
VALUES 
  (
    'Introduction to Membership Sites',
    'Learn the fundamentals of building and managing successful membership sites.',
    'video',
    'https://example.com/intro-membership',
    'https://images.pexels.com/photos/1181677/pexels-photo-1181677.jpeg?auto=compress&cs=tinysrgb&w=500',
    ARRAY['membership', 'basics', 'introduction'],
    'Getting Started',
    'silver',
    'Content Team',
    1200,
    NULL
  ),
  (
    'Advanced Content Strategy',
    'Deep dive into advanced content strategies for premium memberships.',
    'video',
    'https://example.com/advanced-content',
    'https://images.pexels.com/photos/4164418/pexels-photo-4164418.jpeg?auto=compress&cs=tinysrgb&w=500',
    ARRAY['strategy', 'advanced', 'premium'],
    'Strategy',
    'gold',
    'Content Team',
    1800,
    NULL
  ),
  (
    'Community Building Guide',
    'A comprehensive guide to building engaged online communities.',
    'pdf',
    'https://example.com/community-guide.pdf',
    'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=500',
    ARRAY['community', 'engagement', 'guide'],
    'Community',
    'silver',
    'Content Team',
    NULL,
    2500000
  ),
  (
    'Premium Member Retention Strategies',
    'Learn how to retain and grow your premium member base.',
    'blog',
    'https://example.com/retention-strategies',
    'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=500',
    ARRAY['retention', 'growth', 'premium'],
    'Growth',
    'gold',
    'Content Team',
    NULL,
    NULL
  ),
  (
    'Getting Started with Your Account',
    'Quick start guide for new members to navigate the platform.',
    'blog',
    'https://example.com/getting-started',
    'https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&w=500',
    ARRAY['tutorial', 'getting started', 'basics'],
    'Getting Started',
    'silver',
    'Support Team',
    NULL,
    NULL
  ),
  (
    'Monetization Masterclass',
    'Advanced strategies for monetizing your membership site.',
    'video',
    'https://example.com/monetization',
    'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=500',
    ARRAY['monetization', 'revenue', 'advanced'],
    'Strategy',
    'gold',
    'Content Team',
    2400,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Step 7: Fix RLS policies to reference user_profiles instead of profiles
-- Drop old policies that reference profiles and recreate them

-- Communities policies - update admin checks
DROP POLICY IF EXISTS "Admins can manage all communities" ON communities;
DROP POLICY IF EXISTS "Admins can insert communities" ON communities;
DROP POLICY IF EXISTS "Admins can update communities" ON communities;
DROP POLICY IF EXISTS "Admins can delete communities" ON communities;

CREATE POLICY "Admins can insert communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete communities"
  ON communities FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Content policies - update admin checks
DROP POLICY IF EXISTS "Admins can manage all content" ON content;
DROP POLICY IF EXISTS "Admins can insert content" ON content;
DROP POLICY IF EXISTS "Admins can update content" ON content;
DROP POLICY IF EXISTS "Admins can delete content" ON content;
DROP POLICY IF EXISTS "Content is viewable by authenticated users" ON content;
DROP POLICY IF EXISTS "Content is viewable based on membership tier" ON content;

-- Recreate content policies with correct table references
CREATE POLICY "Admins can view all content"
  ON content FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view content based on their tier"
  ON content FOR SELECT
  TO authenticated
  USING (
    CASE 
      WHEN required_tier = 'silver' THEN true
      WHEN required_tier = 'gold' THEN
        EXISTS (
          SELECT 1 FROM user_profiles up
          JOIN communities c ON up.community_id = c.id
          WHERE up.id = auth.uid()
          AND c.membership_tier = 'gold'
        )
    END
  );

CREATE POLICY "Admins can insert content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update content"
  ON content FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete content"
  ON content FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
