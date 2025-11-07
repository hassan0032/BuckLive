import React from 'react';
import { useAdminNotifications } from '../hooks/useAdminNotifications';

const CommunityManagerNotifications: React.FC = () => {
    const { notifications, loading, error } = useAdminNotifications();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-semibold text-[#363f49]">Notifications</h2>
                <p className="text-gray-600 text-sm mt-1">
                    Stay up to date with announcements from the admin team.
                </p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            {notifications.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    <p>No notifications available yet.</p>
                    <p className="text-sm text-gray-400 mt-2">
                        Check back later for new updates from the admin team.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {notifications.map(notification => (
                        <div key={notification.id} className="border border-gray-200 rounded-lg p-5">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-[#363f49]">{notification.title}</h3>
                                </div>
                            </div>
                            <p className="mt-3 text-gray-700 whitespace-pre-line">{notification.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CommunityManagerNotifications;