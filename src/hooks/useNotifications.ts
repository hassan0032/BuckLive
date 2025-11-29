import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Notification {
    id: string;
    user_id: string;
    name: string;
    is_read: boolean;
    created_at: string;
    user_profiles?: {
        first_name: string;
        last_name: string;
    };
}

interface MarkAsReadResult {
    error: string | null;
}

interface DeleteNotificationResult {
    error: string | null;
}

interface UseNotificationsOptions {
    viewAllAsAdmin?: boolean;
}

export const useNotifications = (options: UseNotificationsOptions = {}) => {
    const { viewAllAsAdmin = false } = options;

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Fetch notifications (all for admin, or user-specific)
    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);

            // If not viewing all as admin, get the current user
            let userId: string | null = null;
            if (!viewAllAsAdmin) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    throw new Error('User not authenticated');
                }
                userId = user.id;
            }

            let query = supabase
                .from('notifications')
                .select(`
                    *,
                    user_profiles!notifications_user_id_fkey (
                        first_name,
                        last_name
                    )
                `);

            // Filter by user_id if not viewing all as admin
            if (!viewAllAsAdmin && userId) {
                query = query.eq('user_id', userId);
            }

            const { data, error: fetchError } = await query.order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            setNotifications(data || []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load notifications');
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    }, [viewAllAsAdmin]);

    // Mark notification as read
    const markAsRead = useCallback(
        async (id: string): Promise<MarkAsReadResult> => {
            try {
                setUpdatingId(id);

                const { error: updateError } = await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('id', id);

                if (updateError) throw updateError;

                // Update local state
                setNotifications(prev =>
                    prev.map(notification =>
                        notification.id === id
                            ? { ...notification, is_read: true }
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
    const markAllAsRead = useCallback(async (): Promise<MarkAsReadResult> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            const { error: updateError } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('is_read', false);

            if (updateError) throw updateError;

            // Update local state
            setNotifications(prev =>
                prev.map(notification => ({ ...notification, is_read: true }))
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
        async (id: string): Promise<DeleteNotificationResult> => {
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

        const channelName = viewAllAsAdmin ? 'admin_notifications_changes' : 'notifications_changes';
        const subscription = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                },
                (payload) => {
                    if (viewAllAsAdmin) {
                        // For admin view, refetch to get user profile data
                        fetchNotifications();
                    } else {
                        // For user view, update state directly
                        if (payload.eventType === 'INSERT') {
                            setNotifications(prev => [payload.new as Notification, ...prev]);
                        } else if (payload.eventType === 'UPDATE') {
                            setNotifications(prev =>
                                prev.map(notification =>
                                    notification.id === payload.new.id
                                        ? (payload.new as Notification)
                                        : notification
                                )
                            );
                        } else if (payload.eventType === 'DELETE') {
                            setNotifications(prev =>
                                prev.filter(notification => notification.id !== payload.old.id)
                            );
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchNotifications, viewAllAsAdmin]);

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
