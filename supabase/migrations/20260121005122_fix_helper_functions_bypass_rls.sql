/*
  # Fix Helper Functions to Properly Bypass RLS

  ## Problem
  Helper functions created to prevent circular RLS dependencies are still subject to RLS checks
  because they're missing the `row_security = 'off'` configuration. This causes:
  1. Content library to show no items (RLS blocks content queries)
  2. User roles to potentially show incorrectly (authentication queries fail)

  ## Solution
  Add `SET row_security = 'off'` to all helper functions so they can query user_profiles
  without triggering RLS policies. This is safe because each function only accesses
  the current user's own data via auth.uid().

  ## Security
  These functions are secure because:
  - They use SECURITY DEFINER to bypass RLS
  - They only access data for auth.uid() (the current user)
  - They don't expose other users' data
  - They only return specific safe values (boolean, uuid, text)
*/

-- Helper function to get current user's ID
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = 'off'
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
SET row_security = 'off'
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
SET row_security = 'off'
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
SET row_security = 'off'
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
SET row_security = 'off'
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
SET row_security = 'off'
AS $$
  SELECT community_id FROM user_profiles WHERE id = auth.uid();
$$;
