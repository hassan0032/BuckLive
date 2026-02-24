import React, { FormEvent, useState, useRef } from 'react';
import { Loader2, PlusCircle, Trash2, X, Bell, CheckCircle, Circle, Upload, FileText } from 'lucide-react';
import { useAdminNotifications } from '../hooks/useAdminNotifications';
import { useNotificationContext } from '../contexts/NotificationContext';

import { Notification, ROLE, TARGET_TIER, TargetTier } from '../types';

type TabType = 'create' | 'view';

const AdminNotifications: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('view');

  // For creating admin notifications
  const {
    notifications: adminNotifications,
    loading: adminLoading,
    error: adminError,
    creating,
    deletingId: adminDeletingId,
    createNotification,
    deleteNotification: deleteAdminNotification,
  } = useAdminNotifications();

  // For viewing user notifications from community creation - uses unified context
  const {
    notifications: userNotifications,
    loading: userLoading,
    error: userError,
    updatingId,
    deletingId: userDeletingId,
    unreadCount,
    markAsRead,
    deleteNotification: deleteUserNotification,
  } = useNotificationContext();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetTier, setTargetTier] = useState<TargetTier>(TARGET_TIER.ALL);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setTargetTier(TARGET_TIER.ALL);
    setFormError(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

    const { error: createError } = await createNotification({
      title,
      content,
      pdfFile: selectedFile || undefined,
      targetTier
    });

    if (createError) {
      setFormError(createError);
      setActionError(createError);
      return;
    }

    closeModal();
  };

  const handleDeleteAdminNotification = async (id: string) => {
    setActionError(null);
    const { error: deleteError } = await deleteAdminNotification(id);

    if (deleteError) {
      setActionError(deleteError);
    }
  };

  const handleDeleteUserNotification = async (id: string) => {
    setActionError(null);
    const { error: deleteError } = await deleteUserNotification(id);

    if (deleteError) {
      setActionError(deleteError);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    setActionError(null);
    const { error: markError } = await markAsRead(id);

    if (markError) {
      setActionError(markError);
    }
  };

  // Filter for community notifications only
  const communityNotifications = (userNotifications || []).filter(n => n.type === ROLE.COMMUNITY_MANAGER);

  const formatUserName = (notification: Notification) => {
    if (notification.type === ROLE.COMMUNITY_MANAGER && notification.title) {
      return notification.title;
    }

    const firstName = notification.user_profiles?.first_name || '';
    const lastName = notification.user_profiles?.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'Unknown User';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#363f49]">Notifications</h2>
          <p className="text-gray-600 text-sm mt-1">
            Manage notifications and view community activity
          </p>
        </div>
        {activeTab === 'create' && (
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
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('view')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors relative ${activeTab === 'view'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Community Notifications
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'create'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Admin Notifications
            </div>
          </button>
        </nav>
      </div>

      {actionError && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          {actionError}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'view' ? (
        // View Community Notifications Tab
        <div>
          {userError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {userError}
            </div>
          )}

          {userLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
            </div>
          ) : communityNotifications.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="font-medium">No community notifications yet.</p>
              <p className="text-sm text-gray-400 mt-2">
                Notifications will appear here when managers create new communities.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {communityNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`border rounded-lg p-4 transition-all ${notification.is_read
                    ? 'border-gray-200 bg-gray-50'
                    : 'border-brand-primary/30 bg-brand-primary/5'
                    }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {notification.is_read ? (
                          <CheckCircle className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Circle className="h-5 w-5 text-brand-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${notification.is_read ? 'text-gray-700' : 'text-[#363f49] font-medium'}`}>
                          <span className="font-semibold">
                            {formatUserName(notification)}
                          </span>
                          {' '}created a new community with the following name:{' '}
                          <span className="font-semibold text-brand-primary">
                            {notification.content}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={updatingId === notification.id}
                          className="text-xs text-brand-primary hover:text-brand-d-blue font-medium disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {updatingId === notification.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Mark read'
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUserNotification(notification.id)}
                        disabled={userDeletingId === notification.id}
                        className="text-red-600 hover:text-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {userDeletingId === notification.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Create Admin Notifications Tab
        <div>
          {adminError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {adminError}
            </div>
          )}

          {adminLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
            </div>
          ) : adminNotifications.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p>No notifications have been created yet.</p>
              <p className="text-sm text-gray-400 mt-2">Click "Create Notification" to add your first message.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {adminNotifications.map(notification => (
                <div key={notification.id} className="border border-gray-200 rounded-lg p-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[#363f49]">{notification.title}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(notification.created_at).toLocaleString()}
                        {notification.target_tier && notification.target_tier !== 'all' && (
                          <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                            Target: {notification.target_tier}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteAdminNotification(notification.id)}
                      disabled={adminDeletingId === notification.id}
                      className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {adminDeletingId === notification.id ? (
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
        </div>
      )}

      {/* Create Notification Modal */}
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
              )
              }

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience Tier</label>
                <select
                  value={targetTier}
                  onChange={(e) => setTargetTier(e.target.value as TargetTier)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                >
                  <option value={TARGET_TIER.ALL}>All Tiers</option>
                  <option value={TARGET_TIER.GOLD}>Gold Tier Managers Only</option>
                  <option value={TARGET_TIER.SILVER}>Silver Tier Managers Only</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Notification will only be sent to managers of communities with this tier.
                </p>
              </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (Optional)</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Upload className="h-4 w-4" />
                    {selectedFile ? 'Change PDF' : 'Upload PDF'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.type !== 'application/pdf') {
                          setFormError('Only PDF files are allowed.');
                          return;
                        }
                        if (file.size > 50 * 1024 * 1024) { // 50MB
                          setFormError('File size must be less than 50MB.');
                          return;
                        }
                        setFormError(null);
                        setSelectedFile(file);
                      }
                    }}
                  />
                  {selectedFile && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                      <FileText className="h-4 w-4" />
                      <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-gray-400 hover:text-red-500 ml-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
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
            </form >
          </div >
        </div >
      )}
    </div >
  );
};

export default AdminNotifications;