/*
  # Fix Circular RLS Dependencies with Helper Functions

  ## Problem
  Recent RLS policy optimizations introduced circular dependencies where policies on user_profiles
  query user_profiles itself, creating recursive loops that break authentication and content visibility.

  ## Solution
  Create SECURITY DEFINER helper functions that bypass RLS to safely check user roles and permissions.
  These functions are evaluated once per query and don't trigger RLS on the tables they query.

  ## Changes
  1. Create helper functions with SECURITY DEFINER
     - current_user_role(): Returns the role of the current user
     - current_user_id(): Returns the current user's ID
     - is_admin(): Checks if current user is an admin
     - is_community_manager(): Checks if current user is a community manager
     - is_organization_manager(): Checks if current user is an organization manager
  
  2. These functions bypass RLS and are safe because they only access the current user's data

  ## Security
  These functions are safe because:
  - They only return data about the authenticated user (auth.uid())
  - They use SECURITY DEFINER to bypass RLS only for reading the current user's own profile
  - They don't expose other users' data
*/

-- Helper function to get current user's ID (wrapped in SELECT for optimization)
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

-- Helper function to get current user's role from user_profiles
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$;

-- Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Helper function to check if current user is a community manager
CREATE OR REPLACE FUNCTION is_community_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'community_manager'
  );
$$;

-- Helper function to check if current user is an organization manager
CREATE OR REPLACE FUNCTION is_organization_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'organization_manager'
  );
$$;

-- Helper function to get current user's community_id
CREATE OR REPLACE FUNCTION current_user_community_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT community_id FROM user_profiles WHERE id = auth.uid();
$$;
