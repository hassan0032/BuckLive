import { Bell, Check, Circle } from 'lucide-react';
import React from 'react';
import { useAdminNotifications } from '../hooks/useAdminNotifications';

const CommunityManagerNotifications: React.FC = () => {
    const { notifications, loading, error, markAsRead, markingAsReadId } = useAdminNotifications({
        includeReadStatus: true
    });

    const handleMarkAsRead = async (notificationId: string, isRead?: boolean) => {
        // Only mark as read if it's currently unread
        if (!isRead) {
            await markAsRead(notificationId);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
            </div>
        );
    }

    // Separate unread and read notifications
    const unreadNotifications = notifications.filter(n => !n.is_read);
    const readNotifications = notifications.filter(n => n.is_read);

    return (
        <div className="space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-semibold text-[#363f49]">Notifications</h1>
                    <p className="text-gray-600 mt-1">
                        Stay up to date with announcements from the admin team.
                    </p>
                    {unreadNotifications.length > 0 && (
                        <p className="text-sm text-brand-primary font-medium mt-2">
                            {unreadNotifications.length} unread notification{unreadNotifications.length !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Notifications List */}
            {notifications.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-12">
                    <div className="text-center">
                        <Bell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-[#363f49] mb-2">No Notifications Yet</h3>
                        <p className="text-gray-600 mb-2">
                            You're all caught up! There are no new notifications at this time.
                        </p>
                        <p className="text-sm text-gray-500">
                            Check back later for updates from the admin team.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Unread Notifications */}
                    {unreadNotifications.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                                Unread
                            </h2>
                            <div className="space-y-3">
                                {unreadNotifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleMarkAsRead(notification.id, notification.is_read)}
                                        className="bg-white rounded-lg shadow-sm p-6 border-2 border-brand-primary/30 hover:shadow-md transition-all cursor-pointer bg-brand-primary/5"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="h-10 w-10 rounded-full bg-brand-beige-light flex items-center justify-center">
                                                    <Bell className="h-5 w-5 text-brand-primary" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <h3 className="text-lg font-semibold text-[#363f49]">
                                                        {notification.title}
                                                    </h3>
                                                    {notification.created_at && (
                                                        <span className="text-xs text-gray-500 whitespace-nowrap">
                                                            {new Date(notification.created_at).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                                                    {notification.content}
                                                </p>
                                                {markingAsReadId === notification.id ? (
                                                    <p className="text-xs text-brand-primary mt-2">Marking as read...</p>
                                                ) : (
                                                    <p className="text-xs text-brand-primary mt-2 font-medium">
                                                        Click to mark as read
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Read Notifications */}
                    {readNotifications.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                                Read
                            </h2>
                            <div className="space-y-3">
                                {readNotifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow opacity-75"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                                                    <Check className="h-5 w-5 text-gray-400" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-4 mb-2">
                                                    <h3 className="text-lg font-semibold text-gray-600">
                                                        {notification.title}
                                                    </h3>
                                                    {notification.created_at && (
                                                        <span className="text-xs text-gray-500 whitespace-nowrap">
                                                            {new Date(notification.created_at).toLocaleDateString('en-US', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-gray-600 whitespace-pre-line leading-relaxed">
                                                    {notification.content}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CommunityManagerNotifications;