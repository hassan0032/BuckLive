-- Community-specific PDF metadata table
CREATE TABLE IF NOT EXISTS community_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  public_url text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_community_pdfs_community_id ON community_pdfs(community_id);
CREATE INDEX IF NOT EXISTS idx_community_pdfs_created_at ON community_pdfs(created_at DESC);

ALTER TABLE community_pdfs ENABLE ROW LEVEL SECURITY;
