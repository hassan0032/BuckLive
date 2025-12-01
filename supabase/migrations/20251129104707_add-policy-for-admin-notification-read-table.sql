-- Policies for 'admin_notification_reads' table
-- Users (Community Managers) can VIEW and UPDATE their own read status.
-- Admins can MANAGE (View, Insert, Update, Delete) all records.

ALTER TABLE admin_notification_reads ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SELECT POLICIES
-- ============================================================================

-- Users can view their own read status
DROP POLICY IF EXISTS "Users can view own read status" ON admin_notification_reads;
CREATE POLICY "Users can view own read status"
ON admin_notification_reads FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all read statuses
DROP POLICY IF EXISTS "Admins can view all read statuses" ON admin_notification_reads;
CREATE POLICY "Admins can view all read statuses"
ON admin_notification_reads FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- ============================================================================
-- INSERT POLICIES
-- ============================================================================

-- Admins can insert read statuses (e.g. manual fix)
DROP POLICY IF EXISTS "Admins can insert read statuses" ON admin_notification_reads;
CREATE POLICY "Admins can insert read statuses"
ON admin_notification_reads FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- UPDATE POLICIES
-- ============================================================================

-- Users can update their own read status (e.g. marking as read)
DROP POLICY IF EXISTS "Users can update own read status" ON admin_notification_reads;
CREATE POLICY "Users can update own read status"
ON admin_notification_reads FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can update all read statuses
DROP POLICY IF EXISTS "Admins can update read statuses" ON admin_notification_reads;
CREATE POLICY "Admins can update read statuses"
ON admin_notification_reads FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- DELETE POLICIES
-- ============================================================================

-- Admins can delete read statuses
DROP POLICY IF EXISTS "Admins can delete read statuses" ON admin_notification_reads;
CREATE POLICY "Admins can delete read statuses"
ON admin_notification_reads FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
