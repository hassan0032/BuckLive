import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Notification } from '../types';
import { useNotificationContext } from '../contexts/NotificationContext';

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

interface UseAdminNotificationsOptions {
  includeReadStatus?: boolean;
}

export const useAdminNotifications = (options: UseAdminNotificationsOptions = {}) => {
  const { includeReadStatus = false } = options;

  // If we are in manager mode (includeReadStatus=true), use the global context
  const context = useNotificationContext();

  // Local state for Admin mode (sending notifications)
  const [adminNotifications, setAdminNotifications] = useState<Notification[]>([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminCreating, setAdminCreating] = useState(false);
  const [adminDeletingId, setAdminDeletingId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // ADMIN MODE LOGIC (includeReadStatus = false)
  // --------------------------------------------------------------------------

  const fetchAdminNotifications = useCallback(async () => {
    if (includeReadStatus) return; // Managed by context

    try {
      setAdminLoading(true);

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('type', 'admin')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Group by title/content/created_at to show unique notifications
      const uniqueNotifications = new Map<string, Notification>();
      (data || []).forEach(notification => {
        const key = `${notification.title} -${notification.content} -${notification.created_at} `;
        if (!uniqueNotifications.has(key)) {
          uniqueNotifications.set(key, notification);
        }
      });

      setAdminNotifications(Array.from(uniqueNotifications.values()));
      setAdminError(null);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to load notifications');
      setAdminNotifications([]);
    } finally {
      setAdminLoading(false);
    }
  }, [includeReadStatus]);

  const createAdminNotification = useCallback(
    async ({ title, content }: CreateNotificationInput): Promise<CreateNotificationResult> => {
      try {
        setAdminCreating(true);
        const trimmedTitle = title.trim();
        const trimmedContent = content.trim();

        const { error: insertError } = await supabase
          .from('notifications')
          .insert([
            {
              type: 'admin',
              user_id: null, // NULL triggers broadcast
              title: trimmedTitle,
              content: trimmedContent,
            },
          ]);

        if (insertError) throw insertError;

        await fetchAdminNotifications();
        setAdminError(null);
        return { data: null, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create notification';
        setAdminError(message);
        return { data: null, error: message };
      } finally {
        setAdminCreating(false);
      }
    },
    [fetchAdminNotifications]
  );

  const deleteAdminNotification = useCallback(
    async (id: string): Promise<DeleteNotificationResult> => {
      try {
        setAdminDeletingId(id);
        const notification = adminNotifications.find(n => n.id === id);

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

        setAdminNotifications(prev => prev.filter(n => n.id !== id));
        setAdminError(null);
        return { error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete notification';
        setAdminError(message);
        return { error: message };
      } finally {
        setAdminDeletingId(current => (current === id ? null : current));
      }
    },
    [adminNotifications]
  );

  useEffect(() => {
    if (!includeReadStatus) {
      fetchAdminNotifications();

      const subscription = supabase
        .channel('admin_notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: 'type=eq.admin',
          },
          () => {
            fetchAdminNotifications();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [fetchAdminNotifications, includeReadStatus]);

  // --------------------------------------------------------------------------
  // RETURN VALUES
  // --------------------------------------------------------------------------

  if (includeReadStatus) {
    // Return values from Context (Manager Mode)
    return {
      notifications: context.notifications,
      loading: context.loading,
      error: context.error,
      creating: context.creating,
      deletingId: context.deletingId,
      markingAsReadId: context.markingAsReadId,
      unreadCount: context.unreadCount,
      createNotification: context.createNotification,
      deleteNotification: context.deleteNotification,
      markAsRead: context.markAsRead,
      markAllAsRead: context.markAllAsRead,
      refetch: context.refetch,
    };
  } else {
    // Return values from Local State (Admin Mode)
    return {
      notifications: adminNotifications,
      loading: adminLoading,
      error: adminError,
      creating: adminCreating,
      deletingId: adminDeletingId,
      markingAsReadId: null, // Admins don't mark as read
      unreadCount: 0, // Admins don't have unread count
      createNotification: createAdminNotification,
      deleteNotification: deleteAdminNotification,
      markAsRead: async () => ({ error: 'Not supported for admins' }),
      markAllAsRead: async () => ({ error: 'Not supported for admins' }),
      refetch: fetchAdminNotifications,
    };
  }
};
