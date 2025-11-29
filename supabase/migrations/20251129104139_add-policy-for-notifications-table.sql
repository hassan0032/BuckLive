-- Policies for 'notifications' table
-- Users can only VIEW their own notifications.
-- Admins can MANAGE (View, Insert, Update, Delete) all notifications.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SELECT POLICIES
-- ============================================================================

-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all notifications
DROP POLICY IF EXISTS "Admins can view all notifications" ON notifications;
CREATE POLICY "Admins can view all notifications"
ON notifications FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- ============================================================================
-- INSERT POLICIES
-- ============================================================================

-- Admins can insert notifications
DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;
CREATE POLICY "Admins can insert notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- UPDATE POLICIES
-- ============================================================================

-- Admins can update notifications
DROP POLICY IF EXISTS "Admins can update notifications" ON notifications;
CREATE POLICY "Admins can update notifications"
ON notifications FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- DELETE POLICIES
-- ============================================================================

-- Admins can delete notifications
DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;
CREATE POLICY "Admins can delete notifications"
ON notifications FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
