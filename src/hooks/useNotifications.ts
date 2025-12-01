import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Notification } from '../types';

export const useNotifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Fetch notifications for current user
    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            const { data, error: fetchError } = await supabase
                .from('notifications')
                .select(`
                    *,
                    user_profiles!notifications_user_id_fkey (
                        first_name,
                        last_name
                    )
                `)
                .eq('user_id', user.id)
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

    // Mark notification as read
    const markAsRead = useCallback(
        async (id: string): Promise<{ error: string | null }> => {
            try {
                setUpdatingId(id);

                const { error: updateError } = await supabase
                    .from('notifications')
                    .update({
                        is_read: true,
                        read_at: new Date().toISOString()
                    })
                    .eq('id', id);

                if (updateError) throw updateError;

                // Update local state
                setNotifications(prev =>
                    prev.map(notification =>
                        notification.id === id
                            ? { ...notification, is_read: true, read_at: new Date().toISOString() }
                            : notification
                    )
                );

                setError(null);
                return { error: null };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to mark as read';
                setError(message);
                return { error: message };
            } finally {
                setUpdatingId(current => (current === id ? null : current));
            }
        },
        []
    );

    // Mark all notifications as read
    const markAllAsRead = useCallback(async (): Promise<{ error: string | null }> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            const now = new Date().toISOString();
            const { error: updateError } = await supabase
                .from('notifications')
                .update({
                    is_read: true,
                    read_at: now
                })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (updateError) throw updateError;

            // Update local state
            setNotifications(prev =>
                prev.map(notification => ({
                    ...notification,
                    is_read: true,
                    read_at: notification.read_at || now
                }))
            );

            setError(null);
            return { error: null };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to mark all as read';
            setError(message);
            return { error: message };
        }
    }, []);

    // Delete notification
    const deleteNotification = useCallback(
        async (id: string): Promise<{ error: string | null }> => {
            try {
                setDeletingId(id);

                const { error: deleteError } = await supabase
                    .from('notifications')
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

    // Subscribe to real-time updates
    useEffect(() => {
        fetchNotifications();

        const subscription = supabase
            .channel('notifications_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                },
                (payload) => {
                    // Simple refetch strategy to ensure data consistency
                    // We can optimize this later if needed
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchNotifications]);

    // Calculate unread count
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return {
        notifications,
        loading,
        error,
        updatingId,
        deletingId,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refetch: fetchNotifications,
    };
};
