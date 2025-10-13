/*
  # Complete Fix for Infinite Recursion in RLS Policies
  
  ## Problem Analysis
  The infinite recursion occurs because:
  1. User queries user_profiles table
  2. RLS policy evaluates and calls is_admin(auth.uid())
  3. is_admin() queries user_profiles table
  4. This triggers RLS evaluation again -> infinite loop
  
  Even with SECURITY DEFINER, the function respects RLS by default.
  
  ## Solution Architecture
  1. Create is_admin() function that truly bypasses RLS using explicit security context
  2. Remove ALL existing policies to start fresh
  3. Recreate policies in correct dependency order:
     - Simple policies first (no function calls)
     - Complex policies last (with function calls)
  4. Split complex policies into multiple simple policies
  
  ## Security Notes
  - is_admin() is SECURITY DEFINER but only returns boolean (safe)
  - All policies remain restrictive by default
  - Function uses explicit schema qualification to prevent injection
  - Proper grants ensure function can bypass RLS safely
  
  ## Tables Affected
  - user_profiles: User profile data with role information
  - content: Content library with tier-based access
  - communities: Community information for membership validation
*/

-- ============================================================================
-- STEP 1: Drop ALL existing policies to start fresh
-- ============================================================================

-- Drop all user_profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in same community" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their community" ON user_profiles;

-- Drop all content policies
DROP POLICY IF EXISTS "Content is viewable by authenticated users" ON content;
DROP POLICY IF EXISTS "Content is viewable based on membership tier" ON content;
DROP POLICY IF EXISTS "Content visibility by role and tier" ON content;
DROP POLICY IF EXISTS "Users can view content based on their tier" ON content;
DROP POLICY IF EXISTS "Users can view content based on role and tier" ON content;
DROP POLICY IF EXISTS "Admins can view all content" ON content;
DROP POLICY IF EXISTS "Admins can insert content" ON content;
DROP POLICY IF EXISTS "Admins can update content" ON content;
DROP POLICY IF EXISTS "Admins can delete content" ON content;

-- Drop all communities policies
DROP POLICY IF EXISTS "Communities are viewable by all users" ON communities;
DROP POLICY IF EXISTS "Communities are viewable by authenticated users" ON communities;
DROP POLICY IF EXISTS "Admins can view all communities" ON communities;
DROP POLICY IF EXISTS "Admins can insert communities" ON communities;
DROP POLICY IF EXISTS "Admins can update communities" ON communities;
DROP POLICY IF EXISTS "Admins can delete communities" ON communities;
DROP POLICY IF EXISTS "Admins can manage all communities" ON communities;

-- Drop settings policies if they exist
DROP POLICY IF EXISTS "Admins can view settings" ON settings CASCADE;
DROP POLICY IF EXISTS "Admins can update settings" ON settings CASCADE;

-- ============================================================================
-- STEP 2: Recreate is_admin() function with proper RLS bypass
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

-- Create new function that properly bypasses RLS
-- Key points:
-- 1. SECURITY DEFINER: runs with creator's privileges (postgres/supabase)
-- 2. STABLE: indicates function doesn't modify database
-- 3. SET search_path = public: prevents search_path attacks
-- 4. Explicit schema qualification: prevents SQL injection
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Query user_profiles directly
  -- SECURITY DEFINER allows this to bypass RLS
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id
  LIMIT 1;
  
  -- Return true only if role is explicitly 'admin'
  RETURN COALESCE(user_role = 'admin', false);
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs, user is not admin
    RETURN false;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;

-- ============================================================================
-- STEP 3: Create user_profiles policies (simple to complex)
-- ============================================================================

-- Policy 1: Users can always view their own profile (SIMPLEST - no recursion)
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Users can insert their own profile during signup
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 4: Users can view profiles in same community (no function call)
CREATE POLICY "Users can view profiles in same community"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    community_id IS NOT NULL 
    AND community_id IN (
      SELECT community_id 
      FROM user_profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- Policy 5: Admins can view all profiles (uses function - LAST)
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Policy 6: Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- STEP 4: Create communities policies
-- ============================================================================

-- Policy 1: All authenticated users can view communities (needed for access code validation)
CREATE POLICY "Authenticated users can view communities"
  ON communities FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Admins can insert communities
CREATE POLICY "Admins can insert communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy 3: Admins can update communities
CREATE POLICY "Admins can update communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy 4: Admins can delete communities
CREATE POLICY "Admins can delete communities"
  ON communities FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- STEP 5: Create content policies (split into multiple simple policies)
-- ============================================================================

-- Policy 1: All authenticated users can view silver tier content (SIMPLEST)
CREATE POLICY "Users can view silver content"
  ON content FOR SELECT
  TO authenticated
  USING (required_tier = 'silver');

-- Policy 2: Users with gold membership can view gold content
CREATE POLICY "Gold members can view gold content"
  ON content FOR SELECT
  TO authenticated
  USING (
    required_tier = 'gold'
    AND EXISTS (
      SELECT 1 
      FROM user_profiles up
      JOIN communities c ON up.community_id = c.id
      WHERE up.id = auth.uid()
      AND c.membership_tier = 'gold'
      LIMIT 1
    )
  );

-- Policy 3: Admins can view all content (uses function - LAST)
CREATE POLICY "Admins can view all content"
  ON content FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Policy 4: Admins can insert content
CREATE POLICY "Admins can insert content"
  ON content FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy 5: Admins can update content
CREATE POLICY "Admins can update content"
  ON content FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Policy 6: Admins can delete content
CREATE POLICY "Admins can delete content"
  ON content FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- STEP 6: Create settings policies (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'settings'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view settings" ON settings';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update settings" ON settings';
    
    EXECUTE 'CREATE POLICY "Admins can view settings"
      ON settings FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()))';
    
    EXECUTE 'CREATE POLICY "Admins can update settings"
      ON settings FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()))';
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Verify and fix admin user profile
-- ============================================================================

-- Ensure the admin user has proper profile
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Try to find admin user in auth.users
  BEGIN
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = 'sezzat@buckinstitute.org'
    LIMIT 1;
  EXCEPTION
    WHEN insufficient_privilege THEN
      -- Can't access auth.users, that's ok
      admin_user_id := NULL;
  END;
  
  IF admin_user_id IS NOT NULL THEN
    -- Ensure profile exists with admin role
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
      email = EXCLUDED.email;
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Verify content exists
-- ============================================================================

-- Check if content table is empty and add sample data if needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM content LIMIT 1) THEN
    INSERT INTO content (
      title, 
      description, 
      type, 
      url, 
      thumbnail_url, 
      tags, 
      category, 
      required_tier, 
      author, 
      duration, 
      file_size
    )
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
        'Premium Member Retention',
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
        'Getting Started Guide',
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
  END IF;
END $$;
