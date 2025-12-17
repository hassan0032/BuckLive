-- Migration: drop_users_with_details_view.sql
-- Drop the users_with_details view as it's no longer needed

DROP VIEW IF EXISTS public.users_with_details;
