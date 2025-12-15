/*
  # Update Master Admin Code

  ## Overview
  This migration updates the master admin code value in the settings table.

  ## Changes
  - Updates the value for the 'master_admin_code' key in the settings table
  - The updated_at timestamp will be automatically updated via trigger
*/

-- Update the master admin code
UPDATE settings
SET value = 'ADMINX'
WHERE key = 'master_admin_code';
