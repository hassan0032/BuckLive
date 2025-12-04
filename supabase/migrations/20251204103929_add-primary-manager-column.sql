-- Drop the column if it exists
ALTER TABLE communities
DROP COLUMN IF EXISTS primary_manager;

-- Add the column as a foreign key
ALTER TABLE communities
ADD COLUMN primary_manager uuid REFERENCES auth.users(id) ON DELETE SET NULL;
