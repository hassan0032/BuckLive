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

export const useAdminNotifications = () => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setNotifications(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    loading,
    error,
    creating,
    deletingId,
    createNotification,
    deleteNotification,
    refetch: fetchNotifications,
  };
};

