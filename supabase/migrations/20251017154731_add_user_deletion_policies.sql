/*
  # Add User Deletion Policies for Admins and Community Managers

  ## Overview
  This migration adds DELETE policies to enable admins and community managers
  to delete users from the system. This is necessary for user management functionality.

  ## Changes Made

  ### user_profiles table
  - Add DELETE policy for admins to delete any user profile
  - Add DELETE policy for community managers to delete users in their managed communities

  ## Security
  
  ### DELETE Policies
  - Admins can delete any user profile using is_admin() check
  - Community managers can delete users only in their managed communities
  - Regular users cannot delete any profiles (no policy for self-deletion)
  
  ## Important Notes
  
  - User deletion should cascade to related records through foreign key constraints
  - Deletion is a destructive operation and should be used with caution
  - The Supabase auth.users record will be deleted via admin API, which cascades to user_profiles
*/

-- ============================================================================
-- Add DELETE policies for user_profiles table
-- ============================================================================

-- Admins can delete any user profile
CREATE POLICY "Admins can delete any profile"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Community managers can delete users in their managed communities
CREATE POLICY "Community managers can delete community members"
  ON user_profiles FOR DELETE
  TO authenticated
  USING (
    community_id IN (
      SELECT get_managed_communities(auth.uid())
    )
  );
