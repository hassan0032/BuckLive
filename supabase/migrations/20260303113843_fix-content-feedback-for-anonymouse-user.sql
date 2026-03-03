-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.content_feedback;

-- Recreate with explicit anonymous user support
CREATE POLICY "Anyone can insert feedback"
  ON "public"."content_feedback"
  FOR INSERT
  WITH CHECK (
    -- Allow both authenticated and anonymous users
    (auth.uid() IS NOT NULL) OR
    (auth.uid() IS NULL)
  );

-- Ensure proper grants are set
GRANT SELECT, INSERT ON public.content_feedback TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_feedback TO authenticated;
