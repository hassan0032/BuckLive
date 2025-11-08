import { Bell } from 'lucide-react';
import React from 'react';
import { useAdminNotifications } from '../hooks/useAdminNotifications';

const CommunityManagerNotifications: React.FC = () => {
    const { notifications, loading, error } = useAdminNotifications();

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
                <div className="space-y-4">
                    {notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
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
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CommunityManagerNotifications;