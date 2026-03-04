DROP POLICY IF EXISTS "All users can insert content views" ON content_views;
DROP POLICY IF EXISTS "All users can update content views" ON content_views;

CREATE POLICY "All users can insert content views"
  ON content_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "All users can update content views"
  ON content_views FOR UPDATE
  TO anon, authenticated
  WITH CHECK (true);