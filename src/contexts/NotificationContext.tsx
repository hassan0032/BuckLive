import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Notification } from '../types';
import { useAuth } from './AuthContext';

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

interface NotificationContextType {
    notifications: Notification[];
    loading: boolean;
    error: string | null;
    unreadCount: number;
    creating: boolean;
    deletingId: string | null;
    markingAsReadId: string | null;
    updatingId: string | null; // Alias for markingAsReadId for compatibility
    createNotification: (input: CreateNotificationInput) => Promise<CreateNotificationResult>;
    deleteNotification: (id: string) => Promise<DeleteNotificationResult>;
    markAsRead: (id: string) => Promise<MarkAsReadResult>;
    markAllAsRead: () => Promise<MarkAsReadResult>;
    refetch: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isCommunityManager, isAdmin } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [markingAsReadId, setMarkingAsReadId] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    // Determine notification type based on user role
    const notificationType = isAdmin ? 'community_manager' : 'admin';
    const shouldFetch = (isCommunityManager || isAdmin) && user;

    // Calculate unread count whenever notifications change
    useEffect(() => {
        const relevantNotifications = notifications.filter(n => n.type === notificationType);
        setUnreadCount(relevantNotifications.filter(n => !n.is_read).length);
    }, [notifications, notificationType]);

    const fetchNotifications = useCallback(async () => {
        // Only fetch for community managers or admins
        if (!shouldFetch) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            let query = supabase
                .from('notifications')
                .select(`
                    *,
                    user_profiles!notifications_user_id_fkey (
                        first_name,
                        last_name
                    )
                `)
                .eq('user_id', user!.id)
                .eq('type', notificationType)
                .order('created_at', { ascending: false });

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;
            setNotifications(data || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching notifications:', err);
            setError(err instanceof Error ? err.message : 'Failed to load notifications');
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    }, [user, isCommunityManager, isAdmin, shouldFetch]);

    const createNotification = useCallback(
        async ({ title, content }: CreateNotificationInput): Promise<CreateNotificationResult> => {
            try {
                setCreating(true);

                const trimmedTitle = title.trim();
                const trimmedContent = content.trim();

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

                // Note: We don't refetch here because the broadcast creates copies for managers,
                // and we are likely in an Admin context if we are creating.
                // If the creator is also a manager, the real-time subscription will catch it.

                setError(null);
                return { data: null, error: null };
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
                    .from('notifications')
                    .delete()
                    .eq('id', id);

                if (deleteError) throw deleteError;

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
        []
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

    const markAllAsRead = useCallback(
        async (): Promise<MarkAsReadResult> => {
            try {
                if (!user) {
                    throw new Error('User not authenticated');
                }

                // Get all unread notification IDs for this user of the relevant type
                const relevantNotifications = notifications.filter(n => n.type === notificationType && !n.is_read);
                const unreadIds = relevantNotifications.map(n => n.id);

                if (unreadIds.length === 0) {
                    return { error: null };
                }

                const readDate = new Date().toISOString();

                const { error: updateError } = await supabase
                    .from('notifications')
                    .update({
                        is_read: true,
                        read_at: readDate
                    })
                    .eq('user_id', user.id)
                    .eq('is_read', false)
                    .in('id', unreadIds);

                if (updateError) throw updateError;

                // Update local state
                setNotifications(prev =>
                    prev.map(n => 
                        unreadIds.includes(n.id)
                            ? { ...n, is_read: true, read_at: readDate }
                            : n
                    )
                );

                setError(null);
                return { error: null };
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to mark all as read';
                setError(message);
                return { error: message };
            }
        },
        [notifications, user, notificationType]
    );

    // Initial fetch and real-time subscription
    useEffect(() => {
        fetchNotifications();

        if (!shouldFetch || !user) return;

        // Subscribe to real-time updates for notifications table
        const setupSubscription = async () => {
            const channelName = `notifications_${user.id}_${notificationType}`;

            const subscription = supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        console.log('Notification change detected (Context):', payload);
                        fetchNotifications();
                    }
                )
                .subscribe();

            return subscription;
        };

        const subscriptionPromise = setupSubscription();

        return () => {
            subscriptionPromise.then(subscription => subscription.unsubscribe());
        };
    }, [fetchNotifications, shouldFetch, user, notificationType]);

    const value: NotificationContextType = {
        notifications,
        loading,
        error,
        unreadCount,
        creating,
        deletingId,
        markingAsReadId,
        updatingId: markingAsReadId, // Alias for compatibility
        createNotification,
        deleteNotification,
        markAsRead,
        markAllAsRead,
        refetch: fetchNotifications,
    };

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotificationContext = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotificationContext must be used within a NotificationProvider');
    }
    return context;
};
