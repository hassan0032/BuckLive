import { Calendar, Edit, Key, Mail, Plus, Search, Shield, Trash2, User2, User as UserIcon, Users, Users2 } from 'lucide-react';
import React, { useState } from 'react';
import { DeleteConfirmationModal } from './common/DeleteConfirmationModal';
import { useAuth } from '../contexts/AuthContext';
import { useCommunityUsers } from '../hooks/useCommunityUsers';
import { adminResetUserPassword } from '../lib/supabase';
import { ROLE, ROLE_DISPLAY_NAME } from '../types';
import { cn } from '../utils/helper';
import { CredentialsModal } from './common/CredentialsModal';

interface UserManagementProps {
  communityId: string;
  communityName: string;
}

export const UserManagement: React.FC<UserManagementProps> = ({ communityId, communityName }) => {
  const { user: currentUser } = useAuth();
  const { users, loading, createUser, updateUser, deleteUser } = useCommunityUsers(communityId);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    is_shared_account: false,
    send_email: false,
  });
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.profile?.first_name} ${user.profile?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (editingUser) {
        const userToEdit = users.find(u => u.id === editingUser);
        if (userToEdit) {
          const { error } = await updateUser(editingUser, {
            email: formData.email,
            is_shared_account: formData.is_shared_account,
            profile: {
              first_name: formData.first_name,
              last_name: formData.last_name,
            },
          });

          if (error) throw new Error(error);
        }
      } else {
        if (!formData.password || formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        const { error } = await createUser({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          community_id: communityId,
          is_shared_account: formData.is_shared_account,
          send_email: formData.send_email,
        });

        if (error) throw new Error(error);

        if (formData.send_email) {
          alert('User created successfully and credentials sent via email.');
        } else {
          setCreatedCredentials({
            email: formData.email,
            password: formData.password,
            firstName: formData.first_name,
            lastName: formData.last_name,
            role: ROLE.MEMBER,
          });
        }

        if (error) throw new Error(error);
      }

      setShowCreateForm(false);
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        is_shared_account: false,
        send_email: false,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setFormLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!passwordResetUserId || !newPassword) return;

    setPasswordResetLoading(true);
    try {
      const { error } = await adminResetUserPassword(passwordResetUserId, newPassword);
      if (error) throw new Error(error.message || 'Failed to reset password');

      setShowPasswordResetModal(false);
      setPasswordResetUserId(null);
      setNewPassword('');
      alert('Password reset successfully');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const openPasswordResetModal = (userId: string) => {
    setPasswordResetUserId(userId);
    setNewPassword('');
    setShowPasswordResetModal(true);
  };

  const handleEdit = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setEditingUser(userId);
      setFormData({
        email: user.email,
        password: '',
        first_name: user.profile?.first_name || '',
        last_name: user.profile?.last_name || '',
        is_shared_account: user.is_shared_account || false,
        send_email: false,
      });
      setShowCreateForm(true);
    }
  };

  const handleDeleteClick = (userId: string) => {
    // Prevent deleting own account
    if (currentUser?.id === userId) {
      alert('You cannot delete your own account.');
      return;
    }

    const user = users.find(u => u.id === userId);
    if (!user) return;

    const userName = `${user.profile?.first_name} ${user.profile?.last_name}`.trim() || user.email;
    setUserToDelete({ id: userId, name: userName });
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    setDeletingUser(true);
    try {
      const { error } = await deleteUser(userToDelete.id);
      if (error) {
        throw new Error(error);
      }
      setUserToDelete(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeletingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-[#363f49]">User Management</h2>
          <p className="text-gray-600">Manage users in {communityName}</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({
              email: '',
              password: '',
              first_name: '',
              last_name: '',
              is_shared_account: false,
              send_email: false,
            });
            setShowCreateForm(true);
          }}
          className="flex items-center space-x-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Add User</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const isCurrentUser = currentUser?.id === user.id;

                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center bg-green-100',
                          { 'bg-red-100': user.role === ROLE.ADMIN },
                          { 'bg-blue-100': user.role === ROLE.COMMUNITY_MANAGER },
                        )}>
                          {user.role === ROLE.ADMIN ? (
                            <Shield className="h-5 w-5 text-red-600" />
                          ) : user.role === ROLE.COMMUNITY_MANAGER ? (
                            <Users2 className="h-5 w-5 text-blue-600" />
                          ) : (
                            <User2 className="h-5 w-5 text-green-700" />
                          )}
                        </div>
                        <div className="ml-3">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-[#363f49]">
                              {user.profile?.first_name} {user.profile?.last_name}
                            </p>
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-gray-500">(You)</span>
                            )}
                            {user.is_shared_account && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                <Users className="h-3 w-3 mr-1" />
                                Shared
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-700 text-nowrap',
                        { 'bg-red-100 text-red-700': user.role === ROLE.ADMIN },
                        { 'bg-blue-100 text-blue-700': user.role === ROLE.COMMUNITY_MANAGER },
                      )}>
                        {ROLE_DISPLAY_NAME[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(user.id)}
                          className="text-brand-primary hover:text-brand-d-blue"
                          title="Edit user"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openPasswordResetModal(user.id)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Reset password"
                        >
                          <Key className="h-4 w-4" />
                        </button>
                        {!isCurrentUser && (
                          <button
                            onClick={() => handleDeleteClick(user.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchTerm ? 'No users found matching your search' : 'No users in this community yet'}
            </p>
          </div>
        )}
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>

              {formError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                    disabled={!!editingUser}
                  />
                </div>

                {!editingUser && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password <span className="text-red-500">*</span> (min. 6 characters)
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="flex items-center mt-2">
                      <input
                        id="send_email"
                        type="checkbox"
                        checked={formData.send_email}
                        onChange={(e) => setFormData({ ...formData, send_email: e.target.checked })}
                        className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                      />
                      <label htmlFor="send_email" className="ml-2 text-sm text-gray-700">
                        Send credentials via email
                      </label>
                    </div>
                  </>
                )}

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_shared_account"
                    checked={formData.is_shared_account}
                    onChange={(e) => setFormData({ ...formData, is_shared_account: e.target.checked })}
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                  />
                  <label htmlFor="is_shared_account" className="text-sm font-medium text-gray-700">
                    Shared Account
                  </label>
                  <span className="text-xs text-gray-500">
                    (Multiple users can use this account)
                  </span>
                </div>

                {/* {editingUser && formData.is_shared_account && (
                  <div className="flex items-center space-x-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-purple-700">
                      This is a shared account. The shared account setting cannot be changed after creation.
                    </span>
                  </div>
                )} */}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingUser(null);
                      setFormError(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors uppercase font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm disabled:opacity-50"
                  >
                    {formLoading ? 'Saving...' : editingUser ? 'Update' : 'Create'} User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div >
      )}

      {/* Password Reset Modal */}
      {
        showPasswordResetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Reset Password</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Enter a new password for this user. This will immediately update their login credentials.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password <span className="text-red-500">*</span> (min. 6 characters)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      required
                      minLength={6}
                      placeholder="Enter new password"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordResetModal(false);
                      setPasswordResetUserId(null);
                      setNewPassword('');
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors uppercase font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordReset}
                    disabled={passwordResetLoading || !newPassword || newPassword.length < 6}
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm disabled:opacity-50"
                  >
                    {passwordResetLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
      {
        createdCredentials && (
          <CredentialsModal
            isOpen={!!createdCredentials}
            onClose={() => setCreatedCredentials(null)}
            email={createdCredentials.email}
            password={createdCredentials.password}
            firstName={createdCredentials.firstName}
            lastName={createdCredentials.lastName}
            role={createdCredentials.role}
          />
        )
      }
      <DeleteConfirmationModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.name}? This action cannot be undone.`}
        isDeleting={deletingUser}
      />
    </div >
  );
};
