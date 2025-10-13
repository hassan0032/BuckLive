/*
  # Complete Solution for Infinite Recursion in RLS Policies

  ## Problem Analysis
  
  The infinite recursion occurs because:
  1. When querying user_profiles, RLS policies are evaluated
  2. Some policies call is_admin() or query user_profiles within the policy
  3. This creates a circular dependency: user_profiles query → RLS check → user_profiles query → ...
  
  Specifically:
  - Policy "Users can view profiles in same community" queries user_profiles in its USING clause
  - Policy "Admins can view all profiles" calls is_admin() which queries user_profiles
  - The is_admin() function, despite being SECURITY DEFINER, still respects RLS by default
  
  ## Solution Architecture
  
  1. **Create RLS-Bypassing Function**: 
     - Use SECURITY DEFINER with explicit `SET row_security = off` 
     - This truly bypasses RLS when checking user roles
  
  2. **Remove Circular Dependencies**:
     - Drop the problematic "Users can view profiles in same community" policy
     - Users can view their own profile (no recursion)
     - Admins can view all profiles (using safe function)
  
  3. **Simplify Content Policies**:
     - Use the safe helper function for admin checks
     - Avoid complex joins in policy USING clauses
  
  4. **Policy Order**: 
     - Simple policies first (direct auth.uid() checks)
     - Complex policies last (function calls)
  
  ## Tables Affected
  
  - user_profiles: User profiles with role information
  - content: Content library with tiered access
  - communities: Community information
  - settings: Application settings
  - payments: Payment records

  ## Security Notes
  
  - All policies remain restrictive by default (RLS enabled)
  - SECURITY DEFINER functions only return booleans or simple values
  - Admin checks are centralized in secure functions
  - Users can only see their own data unless explicitly granted access
*/

-- ============================================================================
-- STEP 1: Drop ALL existing policies to start fresh
-- ============================================================================

-- Drop user_profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in same community" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their community" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Drop content policies
DROP POLICY IF EXISTS "Users can view silver content" ON content;
DROP POLICY IF EXISTS "Gold members can view gold content" ON content;
DROP POLICY IF EXISTS "Admins can view all content" ON content;
DROP POLICY IF EXISTS "Admins can insert content" ON content;
DROP POLICY IF EXISTS "Admins can update content" ON content;
DROP POLICY IF EXISTS "Admins can delete content" ON content;
DROP POLICY IF EXISTS "Content is viewable by authenticated users" ON content;
DROP POLICY IF EXISTS "Content visibility by role and tier" ON content;
DROP POLICY IF EXISTS "Users can view content based on their tier" ON content;

-- Drop communities policies
DROP POLICY IF EXISTS "Authenticated users can view communities" ON communities;
DROP POLICY IF EXISTS "Authenticated users can view active communities" ON communities;
DROP POLICY IF EXISTS "Admins can insert communities" ON communities;
DROP POLICY IF EXISTS "Admins can update communities" ON communities;
DROP POLICY IF EXISTS "Admins can delete communities" ON communities;

-- Drop settings policies if they exist
DROP POLICY IF EXISTS "Admins can view settings" ON settings;
DROP POLICY IF EXISTS "Admins can update settings" ON settings;

-- Drop payments policies if they exist
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "System can insert payments" ON payments;

-- ============================================================================
-- STEP 2: Create RLS-bypassing helper functions
-- ============================================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_community_tier(uuid) CASCADE;

-- Create get_user_role function that TRULY bypasses RLS
-- This is the foundation function that all other checks will use
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off  -- This is the KEY to bypassing RLS
AS $$
DECLARE
  user_role text;
BEGIN
  -- Query user_profiles directly without RLS
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id
  LIMIT 1;
  
  RETURN COALESCE(user_role, 'member');
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'member';
END;
$$;

-- Create is_admin function using the safe get_user_role
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN public.get_user_role(user_id) = 'admin';
END;
$$;

-- Create get_user_community_tier function to check membership tier
CREATE OR REPLACE FUNCTION public.get_user_community_tier(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
SET row_security = off  -- Bypass RLS for this check
AS $$
DECLARE
  tier text;
BEGIN
  SELECT c.membership_tier INTO tier
  FROM public.user_profiles up
  JOIN public.communities c ON up.community_id = c.id
  WHERE up.id = user_id
  LIMIT 1;
  
  RETURN COALESCE(tier, 'silver');
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'silver';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_community_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_community_tier(uuid) TO anon;

-- ============================================================================
-- STEP 3: Create user_profiles policies (simple to complex)
-- ============================================================================

-- Policy 1: Users can always view their own profile (SIMPLEST - no recursion possible)
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

-- Policy 4: Admins can view all profiles (uses safe function)
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Policy 5: Admins can update any profile (uses safe function)
CREATE POLICY "Admins can update any profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- NOTE: We removed "Users can view profiles in same community" policy
-- This policy was causing infinite recursion by querying user_profiles within its USING clause
-- If community member visibility is needed, implement it at the application layer

-- ============================================================================
-- STEP 4: Create communities policies
-- ============================================================================

-- Policy 1: All authenticated users can view communities (needed for signup/access code validation)
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
-- STEP 5: Create content policies (simplified)
-- ============================================================================

-- Policy 1: All authenticated users can view silver tier content (SIMPLEST)
CREATE POLICY "Users can view silver content"
  ON content FOR SELECT
  TO authenticated
  USING (required_tier = 'silver');

-- Policy 2: Users with gold membership can view gold content (uses safe function)
CREATE POLICY "Gold members can view gold content"
  ON content FOR SELECT
  TO authenticated
  USING (
    required_tier = 'gold'
    AND public.get_user_community_tier(auth.uid()) = 'gold'
  );

-- Policy 3: Admins can view all content (uses safe function)
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
-- STEP 7: Create payments policies (if table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own payments"
      ON payments FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id)';
    
    EXECUTE 'CREATE POLICY "Admins can view all payments"
      ON payments FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()))';
    
    EXECUTE 'CREATE POLICY "System can insert payments"
      ON payments FOR INSERT
      TO authenticated
      WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Verify admin user exists and has correct role
-- ============================================================================

-- Ensure the admin user has proper profile with admin role
DO $$
DECLARE
  admin_exists boolean;
BEGIN
  -- Check if admin user exists
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE email = 'sezzat@buckinstitute.org'
  ) INTO admin_exists;
  
  IF admin_exists THEN
    -- Update existing admin to ensure role is correct
    UPDATE public.user_profiles 
    SET role = 'admin'
    WHERE email = 'sezzat@buckinstitute.org';
  END IF;
END $$;

-- ============================================================================
-- STEP 9: Verify data exists
-- ============================================================================

-- Check if we have sample content
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM content LIMIT 1) THEN
    -- Add sample content if none exists
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
      duration
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
        1200
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
        1800
      )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
