import { Calendar, Edit, Key, Loader2, Plus, Search, Shield, Trash2, User2, Users, Users2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useOrganizationCommunities } from '../hooks/useOrganizationCommunities';
import { adminResetUserPassword, supabase } from '../lib/supabase';
import { ROLE, Role, ROLE_DISPLAY_NAME, User } from '../types';
import { cn } from '../utils/helper';
import { DeleteConfirmationModal } from './common/DeleteConfirmationModal';
import { EntitySelector } from './common/EntitySelector';

export const OrganizationUserManagement: React.FC = () => {
  const { communities, loading: communitiesLoading } = useOrganizationCommunities();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCommunityFilter, setSelectedCommunityFilter] = useState<string>('all');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: ROLE.MEMBER as Role,
    community_id: '',
    is_shared_account: false,
    managed_community_ids: [] as string[],
  });

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Fetch all users from organization communities
  const fetchUsers = async () => {
    if (communities.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get the organization ID from the first community (all have same org)
      const organizationId = communities[0]?.organization_id;

      if (!organizationId) {
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('users_with_details')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Fetch managed communities for these users
      const userIds = data?.map(u => u.id) || [];
      const { data: managersData } = await supabase
        .from('community_managers')
        .select('user_id, community_id')
        .in('user_id', userIds);

      const managersMap = new Map<string, string[]>();
      if (managersData) {
        managersData.forEach((item: any) => {
          if (!managersMap.has(item.user_id)) {
            managersMap.set(item.user_id, []);
          }
          managersMap.get(item.user_id)?.push(item.community_id);
        });
      }

      // Transform to User type
      const formattedUsers: User[] = (data || []).map(row => ({
        id: row.id,
        email: row.email,
        role: row.role as Role,
        created_at: row.created_at,
        community_id: row.community_id,
        registration_type: row.registration_type,
        subscription_status: row.subscription_status,
        payment_tier: row.payment_tier,
        is_shared_account: row.is_shared_account || false,
        managed_community_ids: managersMap.get(row.id) || [],
        profile: {
          first_name: row.first_name || '',
          last_name: row.last_name || '',
          avatar_url: row.avatar_url || '',
          community: {
            id: row.community_id,
            name: row.community_name,
            membership_tier: row.community_tier,
            organization_id: row.organization_id,
            access_code: 'hidden', // dummy
            is_active: true,
            is_sharable: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            code: row.community_code || '', // Needs to be handled if not in view
          } as any,
        },
      }));

      setUsers(formattedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!communitiesLoading && communities.length > 0) {
      fetchUsers();
    } else if (!communitiesLoading) {
      setLoading(false);
    }
  }, [communities, communitiesLoading]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.profile?.first_name} ${user.profile?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCommunity = selectedCommunityFilter === 'all' || user.community_id === selectedCommunityFilter;

    return matchesSearch && matchesCommunity;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (editingUser) {
        // We use the edge function for updates now to handle manager role syncing properly?
        // Actually, OrganizationUserManagement was doing direct updates to profile.
        // It should match AdminUserManagement practice.
        // But `useAllUsers`'s `updateUser` does direct profile update then handles managers.
        // Here we don't have that hook. We should implement similar logic.

        // 1. Update Profile
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            email: formData.email,
            first_name: formData.first_name,
            last_name: formData.last_name,
            community_id: formData.role === ROLE.MEMBER ? formData.community_id : null,
            is_shared_account: formData.is_shared_account,
          })
          .eq('id', editingUser);

        if (updateError) throw updateError;

        // 2. Handle Managers
        if (formData.role === ROLE.COMMUNITY_MANAGER) {
          // Replace all managed communities with new list
          const { error: deleteError } = await supabase
            .from('community_managers')
            .delete()
            .eq('user_id', editingUser);

          if (deleteError) throw deleteError;

          if (formData.managed_community_ids.length > 0) {
            const { error: insertError } = await supabase
              .from('community_managers')
              .insert(formData.managed_community_ids.map(cid => ({
                user_id: editingUser,
                community_id: cid
              })));

            if (insertError) throw insertError;
          }
        }

      } else {
        // Create new user
        if (!formData.password || formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        if (formData.role === ROLE.MEMBER && !formData.community_id) {
          throw new Error('Please select a community');
        }
        if (formData.role === ROLE.COMMUNITY_MANAGER && formData.managed_community_ids.length === 0) {
          throw new Error('Please select a community');
        }

        const effectiveCommunityId = formData.role === ROLE.MEMBER ? formData.community_id : null;

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          throw new Error('Not authenticated');
        }

        // Call the edge function
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-management`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'create',
            email: formData.email,
            password: formData.password,
            first_name: formData.first_name,
            last_name: formData.last_name,
            community_id: effectiveCommunityId,
            role: formData.role,
            is_shared_account: formData.is_shared_account,
            managed_community_ids: formData.role === ROLE.COMMUNITY_MANAGER ? formData.managed_community_ids : [],
          }),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
          throw new Error(result.error || 'Failed to create user');
        }
      }

      await fetchUsers();
      setShowCreateForm(false);
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: ROLE.MEMBER,
        community_id: '',
        is_shared_account: false,
        managed_community_ids: [],
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
      alert('Password reset successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const handleDeleteClick = (userId: string) => {
    setUserToDelete(userId);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    setDeletingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          user_id: userToDelete,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to delete user');
      }

      await fetchUsers();
      setUserToDelete(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user.id);
    setFormData({
      email: user.email,
      password: '',
      first_name: user.profile?.first_name || '',
      last_name: user.profile?.last_name || '',
      role: user.role,
      community_id: user.community_id || '',
      is_shared_account: user.is_shared_account || false,
      managed_community_ids: user.managed_community_ids || [],
    });
    setShowCreateForm(true);
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#363f49]">User Management</h2>
          <p className="text-gray-600">Manage members and community managers across your organization</p>
        </div>
        {communities.length > 0 && (
          <button
            onClick={() => {
              setEditingUser(null);
              setFormData({
                email: '',
                password: '',
                first_name: '',
                last_name: '',
                role: ROLE.MEMBER,
                community_id: communities[0]?.id || '',
                is_shared_account: false,
                managed_community_ids: [],
              });
              setShowCreateForm(true);
            }}
            className="flex items-center space-x-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add User</span>
          </button>
        )}
      </div>

      {(communitiesLoading || loading) ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        communities.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Communities</h3>
            <p className="text-gray-600">Create a community first to manage users.</p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                />
              </div>
              <select
                value={selectedCommunityFilter}
                onChange={(e) => setSelectedCommunityFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="all">All Communities</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Community</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
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
                              <div className="text-sm font-medium text-gray-900">
                                {user.profile?.first_name} {user.profile?.last_name}
                              </div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
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
                        {/* <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {user.role === ROLE.COMMUNITY_MANAGER ? (
                              <span className="text-xs text-gray-500" title={user.managed_community_ids?.map(id => communities.find(c => c.id === id)?.name).join(', ')}>
                                {user.managed_community_ids?.length
                                  ? user.managed_community_ids.length > 1 ? `${user.managed_community_ids.length} Communities` : communities.find(c => c.id === user.managed_community_ids?.[0])?.name
                                  : 'No Communities'}
                              </span>
                            ) : (
                              user.profile?.community?.name || 'N/A'
                            )}
                          </div>
                        </td> */}
                        <td className="px-6 py-4">
                          <span className={cn('inline-flex px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-700 text-nowrap',
                            { 'bg-red-100 text-red-700': user.role === ROLE.ADMIN },
                            { 'bg-blue-100 text-blue-700': user.role === ROLE.COMMUNITY_MANAGER },
                          )}>
                            {ROLE_DISPLAY_NAME[user.role]}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 text-xs leading-5 font-semibold rounded-full ${user.is_shared_account
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                            }`}>
                            {user.is_shared_account ? 'Shared' : 'Individual'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-brand-primary hover:text-brand-d-blue"
                            title="Edit user"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setPasswordResetUserId(user.id);
                              setShowPasswordResetModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title="Reset password"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(user.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create/Edit User Modal */}
            {showCreateForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-semibold mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h3>

                  {formError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {formError}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                      />
                    </div>

                    {!editingUser && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                        <input
                          type="password"
                          required={!editingUser}
                          minLength={6}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                          placeholder="Minimum 6 characters"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                        disabled={!!editingUser}
                      >
                        <option value={ROLE.MEMBER}>Member</option>
                        <option value={ROLE.COMMUNITY_MANAGER}>Community Manager</option>
                      </select>
                      {editingUser && (
                        <p className="text-xs text-gray-500 mt-1">Role cannot be changed after creation</p>
                      )}
                    </div>

                    {formData.role === ROLE.MEMBER && (
                      // <CommunitySelector
                      //   communities={communities}
                      //   mode="single"
                      //   selectedId={formData.community_id}
                      //   onSelect={(id) => setFormData({ ...formData, community_id: id as string })}
                      //   label="Community"
                      //   required={true}
                      // />
                      <EntitySelector
                        mode="single"
                        required
                        label="Community"
                        entityName="community"
                        entityNamePlural="communities"
                        entities={communities}
                        selectedId={formData.community_id}
                        onSelect={(id) => setFormData({ ...formData, community_id: id as string })}
                      />
                    )}

                    {formData.role === ROLE.COMMUNITY_MANAGER && (
                      // <CommunitySelector
                      //   communities={communities}
                      //   mode="multi"
                      //   selectedIds={formData.managed_community_ids}
                      //   onSelect={(ids) => setFormData({
                      //     ...formData,
                      //     managed_community_ids: ids as string[]
                      //   })}
                      //   label="Managed Communities"
                      //   required={true}
                      // />
                      <EntitySelector
                        mode="multi"
                        required
                        label="Managed Communities"
                        entityName="community"
                        entityNamePlural="communities"
                        entities={communities}
                        selectedIds={formData.managed_community_ids}
                        onSelect={(ids) => setFormData({
                          ...formData,
                          managed_community_ids: ids as string[]
                        })}
                      />
                    )}

                    {formData.role === ROLE.MEMBER && (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.is_shared_account}
                          onChange={(e) => setFormData({ ...formData, is_shared_account: e.target.checked })}
                          className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                        />
                        <label className="ml-2 text-sm text-gray-700">
                          This is a shared account (multiple users can access)
                        </label>
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
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={formLoading}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue disabled:opacity-50"
                      >
                        {formLoading ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Password Reset Modal */}
            {showPasswordResetModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full p-6">
                  <h3 className="text-lg font-semibold mb-4">Reset Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={6}
                        placeholder="Minimum 6 characters"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          setShowPasswordResetModal(false);
                          setPasswordResetUserId(null);
                          setNewPassword('');
                        }}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePasswordReset}
                        disabled={passwordResetLoading || !newPassword || newPassword.length < 6}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue disabled:opacity-50"
                      >
                        {passwordResetLoading ? 'Resetting...' : 'Reset Password'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ))}

      <DeleteConfirmationModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        isDeleting={deletingUser}
      />
    </div >
  );
};

