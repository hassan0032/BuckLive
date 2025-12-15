-- Remove primary_manager column from communities table
-- This is a breaking change for any logic relying on this column
ALTER TABLE communities DROP COLUMN IF EXISTS primary_manager;
