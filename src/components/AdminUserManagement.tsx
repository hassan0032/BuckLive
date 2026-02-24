import { ArrowDown, ArrowUp, ArrowUpDown, Building2, Calendar, Edit, Eye, EyeOff, Key, Mail, Plus, Search, Shield, Trash2, User2, User as UserIcon, Users, Users2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAdminOrganizations } from '../hooks/useAdminOrganizations';
import { useAllUsers } from '../hooks/useAllUsers';
import { useCommunities } from '../hooks/useCommunities';
import { adminResetUserPassword } from '../lib/supabase';
import { ROLE, Role, ROLE_DISPLAY_NAME } from '../types';
import { cn } from '../utils/helper';
import { DeleteConfirmationModal } from './common/DeleteConfirmationModal';
import { EntitySelector } from './common/EntitySelector';
import { SearchableEntitySelector } from './common/SearchableEntitySelector';
import { CredentialsModal } from './common/CredentialsModal';

interface FormData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  community_id: string;
  role: Role;
  is_shared_account: boolean;
  managed_community_ids: string[];
  organization_id: string;
  send_email: boolean;
}

const initialFormData: FormData = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  community_id: '',
  role: ROLE.MEMBER,
  is_shared_account: false,
  managed_community_ids: [],
  organization_id: '',
  send_email: false,
};

export const AdminUserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [communityFilter, setCommunityFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<Role | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  const [sortConfig, setSortConfig] = useState<{ key: 'user' | 'community', direction: 'asc' | 'desc' } | null>(null);

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
  const { organizations } = useAdminOrganizations();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    role: string;
  } | null>(null);

  const stats = {
    totalUsers: users.length,
    admins: users.filter(u => u.role === ROLE.ADMIN).length,
    superAdmins: users.filter(u => u.role === ROLE.ORGANIZATION_MANAGER).length,
    communityManagers: users.filter(u => u.role === ROLE.COMMUNITY_MANAGER).length,
    members: users.filter(u => u.role === ROLE.MEMBER).length,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (formData.role === ROLE.COMMUNITY_MANAGER) {
        if (formData.managed_community_ids.length === 0) {
          throw new Error('Please select at least one community');
        }
      } else if (formData.role === ROLE.ORGANIZATION_MANAGER) {
        if (!formData.organization_id) {
          throw new Error('Please select an organization');
        }
      } else if (formData.role !== ROLE.ADMIN && !formData.community_id) {
        throw new Error('Please select a community');
      }

      if (editingUser) {
        const { error } = await updateUser(editingUser, {
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          community_id: formData.role === ROLE.MEMBER ? formData.community_id : null,
          is_shared_account: formData.is_shared_account,
          managed_community_ids: formData.role === ROLE.COMMUNITY_MANAGER ? formData.managed_community_ids : [],
          organization_id: formData.role === ROLE.ORGANIZATION_MANAGER ? formData.organization_id : undefined,
        });

        if (error) throw new Error(error);
      } else {
        if (!formData.password || formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        if (formData.role === ROLE.MEMBER && !formData.community_id) {
          throw new Error('Please select a community');
        }

        const { error } = await createUser({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          community_id: formData.role === ROLE.MEMBER ? formData.community_id : null,
          role: formData.role,
          is_shared_account: formData.is_shared_account,
          managed_community_ids: formData.role === ROLE.COMMUNITY_MANAGER ? formData.managed_community_ids : [],
          organization_id: formData.role === ROLE.ORGANIZATION_MANAGER ? formData.organization_id : undefined,
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
            role: formData.role,
          });
        }
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
        managed_community_ids: [],
        organization_id: '',
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
        community_id: user.community_id || '',
        role: user.role,
        is_shared_account: user.is_shared_account || false,
        managed_community_ids: user.managed_community_ids || [],
        organization_id: user.profile?.organization?.id || '',
        send_email: false,
      });
      setShowCreateForm(true);
    }
  };

  const handleDeleteClick = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const userName = `${user.profile?.first_name} ${user.profile?.last_name}`.trim() || user.email;
    setUserToDelete({ id: userId, name: userName });
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);
    try {
      const { error } = await deleteUser(userToDelete.id);
      if (error) {
        throw new Error(error);
      }
      setUserToDelete(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (!sortConfig) return 0;

    if (sortConfig.key === 'user') {
      const nameA = `${a.profile?.first_name || ''} ${a.profile?.last_name || ''}`.trim().toLowerCase() || a.email.toLowerCase();
      const nameB = `${b.profile?.first_name || ''} ${b.profile?.last_name || ''}`.trim().toLowerCase() || b.email.toLowerCase();
      if (nameA < nameB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (nameA > nameB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }

    if (sortConfig.key === 'community') {
      let commA = '';
      if (a.role === ROLE.COMMUNITY_MANAGER && a.managed_community_ids && a.managed_community_ids.length > 0) {
        commA = communities.find(c => c.id === a.managed_community_ids![0])?.name || '';
      } else {
        commA = a.profile?.community?.name || '';
      }
      commA = commA.toLowerCase();

      let commB = '';
      if (b.role === ROLE.COMMUNITY_MANAGER && b.managed_community_ids && b.managed_community_ids.length > 0) {
        commB = communities.find(c => c.id === b.managed_community_ids![0])?.name || '';
      } else {
        commB = b.profile?.community?.name || '';
      }
      commB = commB.toLowerCase();

      if (commA < commB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (commA > commB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }

    return 0;
  });

  const handleSort = (key: 'user' | 'community') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
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
              managed_community_ids: [],
              organization_id: '',
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email or community..."
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
              <option value={ROLE.MEMBER}>Member</option>
              <option value={ROLE.COMMUNITY_MANAGER}>Community Manager</option>
              <option value={ROLE.ORGANIZATION_MANAGER}>Organization Manager</option>
              <option value={ROLE.ADMIN}>Admin</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                  onClick={() => handleSort('user')}
                >
                  <div className="flex items-center space-x-1">
                    <span>User</span>
                    <span className="text-gray-400 group-hover:text-gray-600">
                      {sortConfig?.key === 'user' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                  onClick={() => handleSort('community')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Community</span>
                    <span className="text-gray-400 group-hover:text-gray-600">
                      {sortConfig?.key === 'community' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
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
              {sortedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center bg-green-100',
                        { 'bg-red-100': user.role === ROLE.ADMIN },
                        { 'bg-purple-100': user.role === ROLE.ORGANIZATION_MANAGER },
                        { 'bg-blue-100': user.role === ROLE.COMMUNITY_MANAGER },
                      )}>
                        {user.role === ROLE.ADMIN ? (
                          <Shield className="h-5 w-5 text-red-600" />
                        ) : user.role === ROLE.ORGANIZATION_MANAGER ? (
                          <Building2 className="h-5 w-5 text-purple-600" />
                        ) : user.role === ROLE.COMMUNITY_MANAGER ? (
                          <Users2 className="h-5 w-5 text-blue-600" />
                        ) : (
                          <User2 className="h-5 w-5 text-green-700" />
                        )}
                      </div>
                      <div className="ml-3">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-[#363f49]">
                            {user.profile?.first_name} {user.profile?.last_name} {user.id === currentUser?.id && '(You)'}
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
                    <span className={cn('inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-700 text-nowrap',
                      { 'bg-red-100 text-red-700': user.role === ROLE.ADMIN },
                      { 'bg-purple-100 text-purple-700': user.role === ROLE.ORGANIZATION_MANAGER },
                      { 'bg-blue-100 text-blue-700': user.role === ROLE.COMMUNITY_MANAGER },
                    )}>
                      {ROLE_DISPLAY_NAME[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {user.role === ROLE.COMMUNITY_MANAGER && user.managed_community_ids && user.managed_community_ids.length > 0 ? (
                        <span>
                          {communities.find(c => c.id === user.managed_community_ids![0])?.name || 'Unknown Community'}
                          {user.managed_community_ids!.length > 1 && (
                            <span className="text-gray-400 ml-1" title={
                              // Optional: Show full list on hover
                              user.managed_community_ids!.slice(1).map(id => communities.find(c => c.id === id)?.name).join(', ')
                            }>
                              +{user.managed_community_ids!.length - 1} more
                            </span>
                          )}
                        </span>
                      ) : (
                        user.profile?.community?.name || 'N/A'
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.id !== currentUser?.id && (
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
                          onClick={() => {
                            handleDeleteClick(user.id);
                          }}
                          className="text-red-600 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
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

      <DeleteConfirmationModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.name}? This action cannot be undone.`}
        isDeleting={deleteLoading}
      />

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email {!editingUser && <span className="text-red-500">*</span>}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                    disabled={!!editingUser}
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password <span className="text-red-500">*</span> (min. 6 characters)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
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
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role {!editingUser && <span className="text-red-500">*</span>}
                  </label>
                  {(() => {

                    return (
                      <>
                        <select
                          value={formData.role}
                          onChange={(e) => {
                            const newRole = e.target.value as Role;
                            setFormData({
                              ...formData,
                              role: newRole,
                              is_shared_account: newRole === ROLE.MEMBER ? formData.is_shared_account : false,
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                          required
                        >
                          <option value={ROLE.MEMBER}>Member</option>
                          <option value={ROLE.COMMUNITY_MANAGER}>Community Manager</option>
                          <option value={ROLE.ORGANIZATION_MANAGER}>Organization Manager</option>
                          <option value={ROLE.ADMIN}>Admin</option>
                        </select>
                      </>
                    );
                  })()}

                  {formData.role === ROLE.ADMIN && (
                    <p className="mt-1 text-xs text-amber-600">
                      Warning: Admin users have full system access
                    </p>
                  )}
                </div>

                {formData.role === ROLE.MEMBER && (
                  <EntitySelector
                    mode="single"
                    required={!editingUser}
                    label="Community"
                    entityName="community"
                    entityNamePlural="communities"
                    entities={communities}
                    selectedId={formData.community_id}
                    onSelect={(id) => setFormData({ ...formData, community_id: id as string })}
                  />
                )}

                {formData.role === ROLE.COMMUNITY_MANAGER && (
                  <EntitySelector
                    mode="multi"
                    required
                    label="Managed Communities"
                    entityName="community"
                    entityNamePlural="communities"
                    entities={communities}
                    selectedIds={formData.managed_community_ids}
                    onSelect={(ids) => setFormData({ ...formData, managed_community_ids: ids as string[] })}
                  />
                )}

                {formData.role === ROLE.ORGANIZATION_MANAGER && (
                  <SearchableEntitySelector
                    mode="single"
                    required={!editingUser}
                    label="Organization"
                    entityName="organization"
                    entityNamePlural="organizations"
                    entities={organizations}
                    selectedId={formData.organization_id}
                    onSelect={(id) => setFormData({ ...formData, organization_id: id as string })}
                  />
                )}

                {formData.role === ROLE.MEMBER && (
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
              </form >
            </div >
          </div >
        </div >
      )}

      {/* Password Reset Modal */}
      {
        showPasswordResetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
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
    </div >
  );
};
