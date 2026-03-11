DROP POLICY IF EXISTS "Admins can view all feedback" ON public.content_feedback;
DROP POLICY IF EXISTS "Admins and managers can view all feedback" ON public.content_feedback;

CREATE OR REPLACE FUNCTION is_community_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'community_manager'
  );
$$;

CREATE POLICY "Admins and managers can view all feedback"
  ON public.content_feedback
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR is_community_manager()
  );
