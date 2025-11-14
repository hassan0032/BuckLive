import React, { FormEvent, useState } from 'react';
import { Loader2, PlusCircle, Trash2, X } from 'lucide-react';
import { useAdminNotifications } from '../hooks/useAdminNotifications';

const AdminNotifications: React.FC = () => {
    const {
        notifications,
        loading,
        error,
        creating,
        deletingId,
        createNotification,
        deleteNotification,
    } = useAdminNotifications();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const resetForm = () => {
        setTitle('');
        setContent('');
        setFormError(null);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const handleCreateNotification = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError(null);
        setActionError(null);

        if (!title.trim()) {
            setFormError('Title is required.');
            return;
        }

        if (!content.trim()) {
            setFormError('Content is required.');
            return;
        }

        const { error: createError } = await createNotification({ title, content });

        if (createError) {
            setFormError(createError);
            setActionError(createError);
            return;
        }

        closeModal();
    };

    const handleDelete = async (id: string) => {
        setActionError(null);
        const { error: deleteError } = await deleteNotification(id);

        if (deleteError) {
            setActionError(deleteError);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-semibold text-[#363f49]">Admin Notifications</h2>
                    <p className="text-gray-600 text-sm mt-1">
                        Create and manage notifications that appear on Community Manager dashboard.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setIsModalOpen(true);
                        setFormError(null);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg shadow-sm hover:bg-brand-d-blue transition-colors"
                >
                    <PlusCircle className="h-5 w-5" />
                    Create Notification
                </button>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            {actionError && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                    {actionError}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
                </div>
            ) : notifications.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    <p>No notifications have been created yet.</p>
                    <p className="text-sm text-gray-400 mt-2">Click &quot;Create Notification&quot; to add your first message.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {notifications.map(notification => (
                        <div key={notification.id} className="border border-gray-200 rounded-lg p-5">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-[#363f49]">{notification.title}</h3>
                                    <p className="text-sm text-gray-500">
                                        {new Date(notification.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDelete(notification.id)}
                                    disabled={deletingId === notification.id}
                                    className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {deletingId === notification.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                    Delete
                                </button>
                            </div>
                            <p className="mt-3 text-gray-700 whitespace-pre-line">{notification.content}</p>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-lg w-full">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h3 className="text-xl font-semibold text-[#363f49]">Create Notification</h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateNotification} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={event => setTitle(event.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                                    placeholder="Enter notification title"
                                    maxLength={120}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                                <textarea
                                    value={content}
                                    onChange={event => setContent(event.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                                    rows={5}
                                    placeholder="Enter notification content"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminNotifications;