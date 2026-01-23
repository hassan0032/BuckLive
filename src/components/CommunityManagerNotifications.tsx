import { Bell, Check, FileText } from 'lucide-react';
import React from 'react';
import { useAdminNotifications } from '../hooks/useAdminNotifications';

const CommunityManagerNotifications: React.FC = () => {
    const { notifications, loading, error, markAsRead, markAllAsRead, markingAsReadId } = useAdminNotifications({
        includeReadStatus: true
    });

    const handleMarkAsRead = async (notificationId: string, isRead?: boolean) => {
        // Only mark as read if it's currently unread
        if (!isRead) {
            await markAsRead(notificationId);
        }
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
            </div>
        );
    }



    return (
        <div className="space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-semibold text-[#363f49]">Notifications</h1>
                    <p className="text-gray-600 mt-1">
                        Stay up to date with announcements from the admin team.
                    </p>
                    {notifications.filter(n => !n.is_read).length > 0 && (
                        <p className="text-sm text-brand-primary font-medium mt-2">
                            {notifications.filter(n => !n.is_read).length} unread notification{notifications.filter(n => !n.is_read).length !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
                <button
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors font-medium text-sm disabled:opacity-50"
                    disabled={!notifications.some(n => !n.is_read)}
                    onClick={handleMarkAllAsRead}
                >
                    <Check className="h-4 w-4" />
                    Mark All as Read
                </button>
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
                <div className="space-y-3">
                    {notifications.map((notification) => {
                        const isUnread = !notification.is_read;
                        return (
                            <div
                                key={notification.id}
                                onClick={() => isUnread && handleMarkAsRead(notification.id)}
                                className={`rounded-lg shadow-sm p-6 transition-all ${isUnread
                                    ? 'bg-white border-2 border-brand-primary/30 hover:shadow-md cursor-pointer bg-brand-primary/5'
                                    : 'bg-white border border-gray-200 opacity-75'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0 mt-1">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isUnread ? 'bg-brand-beige-light' : 'bg-gray-100'
                                            }`}>
                                            {isUnread ? (
                                                <Bell className="h-5 w-5 text-brand-primary" />
                                            ) : (
                                                <Check className="h-5 w-5 text-gray-400" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <h3 className={`text-lg font-semibold ${isUnread ? 'text-[#363f49]' : 'text-gray-600'}`}>
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
                                        <p className={`${isUnread ? 'text-gray-700' : 'text-gray-600'} whitespace-pre-line leading-relaxed`}>
                                            {notification.content}
                                        </p>
                                        {notification.pdf_url && (
                                            <div className="mt-3">
                                                <a
                                                    href={notification.pdf_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 border border-gray-200 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <FileText className="h-4 w-4 text-brand-primary" />
                                                    View Attachment
                                                </a>
                                            </div>
                                        )}
                                        {isUnread && (
                                            markingAsReadId === notification.id ? (
                                                <p className="text-xs text-brand-primary mt-2">Marking as read...</p>
                                            ) : (
                                                <p className="text-xs text-brand-primary mt-2 font-medium">
                                                    Click to mark as read
                                                </p>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CommunityManagerNotifications;