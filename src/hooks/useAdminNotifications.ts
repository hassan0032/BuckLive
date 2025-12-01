import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Notification } from '../types';

interface CreateNotificationInput {
  title: string;
  content: string;
}

interface CreateNotificationResult {
  data: Notification | null;
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

export const useAdminNotifications = (options: UseAdminNotificationsOptions = {}) => {
  const { includeReadStatus = false } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingAsReadId, setMarkingAsReadId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      if (includeReadStatus) {
        // For community managers: fetch admin-type notifications for current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        const { data, error: fetchError } = await supabase
          .from('notifications')
          .select('*')
          .eq('type', 'admin')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setNotifications(data || []);
      } else {
        // For admins: fetch all admin-type notifications
        // Note: This gets all copies, so you may want to group by created_at/title/content
        // or use a different query approach
        const { data, error: fetchError } = await supabase
          .from('notifications')
          .select('*')
          .eq('type', 'admin')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        // Group by title/content/created_at to show unique notifications
        // (since each admin notification creates multiple copies for managers)
        const uniqueNotifications = new Map<string, Notification>();
        (data || []).forEach(notification => {
          const key = `${notification.title}-${notification.content}-${notification.created_at}`;
          if (!uniqueNotifications.has(key)) {
            uniqueNotifications.set(key, notification);
          }
        });

        setNotifications(Array.from(uniqueNotifications.values()));
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

        // Insert with type='admin' and user_id=null to trigger broadcast
        // Note: The BEFORE INSERT trigger will return NULL, preventing the template
        // row from being stored. Instead, it creates copies for all community managers.
        // So we don't use .select().single() here as it would fail with 0 rows.
        const { error: insertError } = await supabase
          .from('notifications')
          .insert([
            {
              type: 'admin',
              user_id: null, // NULL triggers the broadcast to all community managers
              title: trimmedTitle,
              content: trimmedContent,
            },
          ]);

        if (insertError) throw insertError;

        // Refetch to get the actual notifications created by the trigger
        await fetchNotifications();

        setError(null);
        return { data: null, error: null }; // No single notification to return (broadcast creates multiple)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create notification';
        setError(message);
        return { data: null, error: message };
      } finally {
        setCreating(false);
      }
    },
    [fetchNotifications]
  );

  const deleteNotification = useCallback(
    async (id: string): Promise<DeleteNotificationResult> => {
      try {
        setDeletingId(id);

        // Find the notification to get its details
        const notification = notifications.find(n => n.id === id);

        if (includeReadStatus) {
          // For managers: delete only their copy
          const { error: deleteError } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);

          if (deleteError) throw deleteError;
        } else {
          // For admins: delete all copies with same title/content/created_at
          if (notification) {
            const { error: deleteError } = await supabase
              .from('notifications')
              .delete()
              .eq('type', 'admin')
              .eq('title', notification.title)
              .eq('content', notification.content)
              .eq('created_at', notification.created_at);

            if (deleteError) throw deleteError;
          }
        }

        setNotifications(prev => prev.filter(n => n.id !== id));
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
    [notifications, includeReadStatus]
  );

  const markAsRead = useCallback(
    async (notificationId: string): Promise<MarkAsReadResult> => {
      try {
        setMarkingAsReadId(notificationId);

        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            is_read: true,
            read_at: new Date().toISOString()
          })
          .eq('id', notificationId);

        if (updateError) throw updateError;

        // Update local state
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
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
    []
  );

  useEffect(() => {
    fetchNotifications();

    // Subscribe to real-time updates for notifications table
    const channelName = includeReadStatus ? 'manager_notifications' : 'admin_notifications';

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: includeReadStatus ? undefined : 'type=eq.admin',
        },
        () => {
          // Refetch to get updated data
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
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

