import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AdminNotification } from '../types';

interface CreateNotificationInput {
  title: string;
  content: string;
}

interface CreateNotificationResult {
  data: AdminNotification | null;
  error: string | null;
}

interface DeleteNotificationResult {
  error: string | null;
}

interface MarkAsReadResult {
  error: string | null;
}

interface UseAdminNotificationsOptions {
  includeReadStatus?: boolean;
}

export interface AdminNotificationWithReadStatus extends AdminNotification {
  is_read?: boolean;
  read_entry_id?: string;
}

export const useAdminNotifications = (options: UseAdminNotificationsOptions = {}) => {
  const { includeReadStatus = false } = options;

  const [notifications, setNotifications] = useState<AdminNotificationWithReadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingAsReadId, setMarkingAsReadId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      if (includeReadStatus) {
        // For managers: fetch notifications with read status from junction table
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        const { data, error: fetchError } = await supabase
          .from('admin_notifications')
          .select(`
            *,
            admin_notification_reads!inner (
              id,
              is_read
            )
          `)
          .eq('admin_notification_reads.user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        // Transform the data to flatten the read status
        const transformedData = (data || []).map((notification: any) => ({
          ...notification,
          is_read: notification.admin_notification_reads?.[0]?.is_read || false,
          read_entry_id: notification.admin_notification_reads?.[0]?.id,
          admin_notification_reads: undefined, // Remove the nested object
        }));

        setNotifications(transformedData);
      } else {
        // For admins: fetch all notifications without read status
        const { data, error: fetchError } = await supabase
          .from('admin_notifications')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setNotifications(data || []);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [includeReadStatus]);

  const createNotification = useCallback(
    async ({ title, content }: CreateNotificationInput): Promise<CreateNotificationResult> => {
      try {
        setCreating(true);

        const trimmedTitle = title.trim();
        const trimmedContent = content.trim();

        const { data, error: insertError } = await supabase
          .from('admin_notifications')
          .insert([
            {
              title: trimmedTitle,
              content: trimmedContent,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;

        if (data) {
          setNotifications(prev => [data, ...prev]);
        }

        setError(null);
        return { data: data ?? null, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create notification';
        setError(message);
        return { data: null, error: message };
      } finally {
        setCreating(false);
      }
    },
    []
  );

  const deleteNotification = useCallback(
    async (id: string): Promise<DeleteNotificationResult> => {
      try {
        setDeletingId(id);

        const { error: deleteError } = await supabase
          .from('admin_notifications')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;

        setNotifications(prev => prev.filter(notification => notification.id !== id));
        setError(null);
        return { error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete notification';
        setError(message);
        return { error: message };
      } finally {
        setDeletingId(current => (current === id ? null : current));
      }
    },
    []
  );

  const markAsRead = useCallback(
    async (notificationId: string): Promise<MarkAsReadResult> => {
      try {
        setMarkingAsReadId(notificationId);

        // Find the read entry ID for this notification
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification?.read_entry_id) {
          throw new Error('Read entry not found');
        }

        const { error: updateError } = await supabase
          .from('admin_notification_reads')
          .update({
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', notification.read_entry_id);

        if (updateError) throw updateError;

        // Update local state
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, is_read: true }
              : n
          )
        );

        setError(null);
        return { error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to mark as read';
        setError(message);
        return { error: message };
      } finally {
        setMarkingAsReadId(null);
      }
    },
    [notifications]
  );

  useEffect(() => {
    fetchNotifications();

    // Subscribe to real-time updates for admin_notifications
    const channelName = includeReadStatus ? 'manager_admin_notifications' : 'admin_admin_notifications';
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_notifications',
        },
        () => {
          // Refetch to get updated data with read status
          fetchNotifications();
        }
      )
      .subscribe();

    // Also subscribe to read status changes if includeReadStatus is true
    let readSubscription: any = null;
    if (includeReadStatus) {
      readSubscription = supabase
        .channel('admin_notification_reads_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'admin_notification_reads',
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();
    }

    return () => {
      subscription.unsubscribe();
      if (readSubscription) {
        readSubscription.unsubscribe();
      }
    };
  }, [fetchNotifications, includeReadStatus]);

  // Calculate unread count (only relevant when includeReadStatus is true)
  const unreadCount = includeReadStatus
    ? notifications.filter(n => !n.is_read).length
    : 0;

  return {
    notifications,
    loading,
    error,
    creating,
    deletingId,
    markingAsReadId,
    unreadCount,
    createNotification,
    deleteNotification,
    markAsRead,
    refetch: fetchNotifications,
  };
};

