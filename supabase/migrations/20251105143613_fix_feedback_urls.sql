-- Complete cleanup and recreation of content_feedback table with proper RLS

-- Step 1: Drop all existing policies
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Anonymous users can insert feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Authenticated users can insert feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON public.content_feedback;

-- Step 2: Disable RLS temporarily
ALTER TABLE public.content_feedback DISABLE ROW LEVEL SECURITY;

-- Step 3: Re-enable RLS
ALTER TABLE public.content_feedback ENABLE ROW LEVEL SECURITY;

-- Step 4: Create policies with explicit role targeting

-- Allow anonymous users to insert
CREATE POLICY "Anonymous users can insert feedback"
  ON public.content_feedback
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to insert  
CREATE POLICY "Authenticated users can insert feedback"
  ON public.content_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow admins to view all feedback
CREATE POLICY "Admins can view all feedback"
  ON public.content_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Allow admins to update feedback
CREATE POLICY "Admins can update feedback"
  ON public.content_feedback
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Allow admins to delete feedback
CREATE POLICY "Admins can delete feedback"
  ON public.content_feedback
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Step 5: Verify grants
GRANT SELECT ON public.content_feedback TO authenticated;
GRANT INSERT ON public.content_feedback TO anon, authenticated;
GRANT UPDATE ON public.content_feedback TO authenticated;
GRANT DELETE ON public.content_feedback TO authenticated;

-- Step 6: Check the policies
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'content_feedback';