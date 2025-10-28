import { Building2, Calendar, Edit, Key, Mail, Plus, Search, Shield, Trash2, User as UserIcon, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAllUsers } from '../hooks/useAllUsers';
import { useCommunities } from '../hooks/useCommunities';
import { adminResetUserPassword } from '../lib/supabase';
import { PAYMENT_TIER, ROLE, Role } from '../types';
import { cn } from '../utils/helper';

interface FormData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  community_id: string;
  role: Role;
  is_shared_account: boolean;
}

const initialFormData: FormData = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  community_id: '',
  role: ROLE.MEMBER,
  is_shared_account: false,
};

export const AdminUserManagement: React.FC = () => {
  const [communityFilter, setCommunityFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<Role | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 700);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { users, loading, createUser, updateUser, deleteUser } = useAllUsers({
    communityId: communityFilter || undefined,
    role: roleFilter || undefined,
    searchTerm: debouncedSearch || undefined,
  });

  const { communities } = useCommunities();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);

  const stats = {
    totalUsers: users.length,
    admins: users.filter(u => u.role === ROLE.ADMIN).length,
    communityManagers: users.filter(u => u.role === ROLE.COMMUNITY_MANAGER).length,
    members: users.filter(u => u.role === ROLE.MEMBER).length,
    goldTier: users.filter(u => u.payment_tier === PAYMENT_TIER.GOLD).length,
    silverTier: users.filter(u => u.payment_tier === PAYMENT_TIER.SILVER).length,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (editingUser) {
        const { error } = await updateUser(editingUser, {
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          community_id: formData.community_id,
        });

        if (error) throw new Error(error);
      } else {
        if (!formData.password || formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        if (!formData.community_id) {
          throw new Error('Please select a community');
        }

        const { error } = await createUser({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          community_id: formData.community_id,
          role: formData.role,
          is_shared_account: formData.is_shared_account,
        });

        if (error) throw new Error(error);
      }

      setShowCreateForm(false);
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        community_id: '',
        role: ROLE.MEMBER,
        is_shared_account: false,
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
        community_id: user.community_id || '',
        role: user.role,
        is_shared_account: user.is_shared_account || false,
      });
      setShowCreateForm(true);
    }
  };

  const handleDelete = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const userName = `${user.profile?.first_name} ${user.profile?.last_name}`.trim() || user.email;

    if (confirm(`Are you sure you want to delete ${userName}? This action cannot be undone and will remove all associated data.`)) {
      const { error } = await deleteUser(userId);
      if (error) {
        alert(`Failed to delete user: ${error}`);
      }
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
          <p className="text-gray-600">Manage all users across the platform</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({
              email: '',
              password: '',
              first_name: '',
              last_name: '',
              community_id: '',
              role: ROLE.MEMBER,
              is_shared_account: false,
            });
            setShowCreateForm(true);
          }}
          className="flex items-center space-x-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Add User</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Total Users</p>
          <p className="text-2xl font-bold text-[#363f49] mt-1">{stats.totalUsers}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Admins</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.admins}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Managers</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.communityManagers}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Members</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.members}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Gold Tier</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.goldTier}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs font-medium text-gray-600 uppercase">Silver Tier</p>
          <p className="text-2xl font-bold text-gray-600 mt-1">{stats.silverTier}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <select
              value={communityFilter}
              onChange={(e) => setCommunityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
            >
              <option value="">All Communities</option>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as Role)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
            >
              <option value="">All Roles</option>
              <option value={ROLE.ADMIN}>Admin</option>
              <option value={ROLE.COMMUNITY_MANAGER}>Community Manager</option>
              <option value={ROLE.MEMBER}>Member</option>
            </select>
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
                  Community
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tier
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
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center bg-brand-beige-light',
                        { 'bg-red-100': user.role === ROLE.ADMIN },
                        { 'bg-blue-100': user.role === ROLE.COMMUNITY_MANAGER },
                      )}>
                        {user.role === ROLE.ADMIN ? (
                          <Shield className="h-5 w-5 text-red-600" />
                        ) : user.role === ROLE.COMMUNITY_MANAGER ? (
                          <Building2 className="h-5 w-5 text-blue-600" />
                        ) : (
                          <UserIcon className="h-5 w-5 text-brand-primary" />
                        )}
                      </div>
                      <div className="ml-3">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-[#363f49]">
                            {user.profile?.first_name} {user.profile?.last_name}
                          </p>
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
                    <span className={cn('inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-700',
                      { 'bg-red-100 text-red-700': user.role === ROLE.ADMIN },
                      { 'bg-blue-100 text-blue-700': user.role === ROLE.COMMUNITY_MANAGER }
                    )}>
                      {user.role === ROLE.COMMUNITY_MANAGER ? 'MANAGER' : user.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {user.profile?.community?.name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.payment_tier ? (
                      <span
                        className={cn('inline-flex px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700',
                          { 'bg-yellow-100 text-yellow-700': user.payment_tier === PAYMENT_TIER.GOLD }
                        )}
                      >
                        {user.payment_tier.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
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
                        type="button"
                        onClick={() => handleEdit(user.id)}
                        className="text-brand-primary hover:text-brand-d-blue"
                        title="Edit user"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openPasswordResetModal(user.id)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Reset password"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchTerm || communityFilter || roleFilter
                ? 'No users found matching your filters'
                : 'No users in the system yet'}
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
                      First Name *
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
                      Last Name *
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password * (min. 6 characters)
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
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Community *
                  </label>
                  <select
                    value={formData.community_id}
                    onChange={(e) => setFormData({ ...formData, community_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  >
                    <option value="">Select a community</option>
                    {communities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  >
                    <option value={ROLE.MEMBER}>Member</option>
                    <option value={ROLE.COMMUNITY_MANAGER}>Community Manager</option>
                    <option value={ROLE.ADMIN}>Admin</option>
                  </select>
                  {formData.role === ROLE.ADMIN && (
                    <p className="mt-1 text-xs text-amber-600">
                      Warning: Admin users have full system access
                    </p>
                  )}
                </div>

                {!editingUser && (
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
                )}

                {editingUser && formData.is_shared_account && (
                  <div className="flex items-center space-x-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="text-sm text-purple-700">
                      This is a shared account. The shared account setting cannot be changed after creation.
                    </span>
                  </div>
                )}

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
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordResetModal && (
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
                    New Password * (min. 6 characters)
                  </label>
                  <input
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
      )}
    </div>
  );
};
