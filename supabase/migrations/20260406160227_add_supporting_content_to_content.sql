-- Add supporting content references to content table
ALTER TABLE content
ADD COLUMN IF NOT EXISTS supporting_content UUID[] NOT NULL DEFAULT '{}'::uuid[];

-- Optimize lookups for array containment/overlap queries
CREATE INDEX IF NOT EXISTS content_supporting_content_gin_idx
ON content
USING GIN (supporting_content);
