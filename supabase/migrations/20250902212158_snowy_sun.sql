/*
  # Add membership tiers system

  1. Database Changes
    - Add `membership_tier` column to communities table (silver/gold)
    - Add `required_tier` column to content table (silver/gold)
    - Update RLS policies to enforce tier-based access

  2. Security
    - Update content RLS policies to check user's community tier
    - Ensure users can only access content appropriate for their tier

  3. Default Values
    - Communities default to 'silver' tier
    - Content defaults to 'silver' tier (accessible to all)
*/

-- Add membership_tier to communities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communities' AND column_name = 'membership_tier'
  ) THEN
    ALTER TABLE communities ADD COLUMN membership_tier text DEFAULT 'silver' CHECK (membership_tier IN ('silver', 'gold'));
  END IF;
END $$;

-- Add required_tier to content table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content' AND column_name = 'required_tier'
  ) THEN
    ALTER TABLE content ADD COLUMN required_tier text DEFAULT 'silver' CHECK (required_tier IN ('silver', 'gold'));
  END IF;
END $$;

-- Update content RLS policies to enforce tier-based access
DROP POLICY IF EXISTS "Content is viewable by authenticated users" ON content;

CREATE POLICY "Content is viewable based on membership tier"
  ON content
  FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all content
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR
    -- Users can see content if their community tier allows it
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN communities c ON p.community_id = c.id
      WHERE p.id = auth.uid()
      AND (
        content.required_tier = 'silver' 
        OR (content.required_tier = 'gold' AND c.membership_tier = 'gold')
      )
    )
  );