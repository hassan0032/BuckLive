import { Edit, Key, Loader2, Plus, Shield, Trash2, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useCommunities } from '../hooks/useCommunities';
import { useManagedCommunities } from '../hooks/useManagedCommunities';
import { useAdminEmailNotification } from '../hooks/useAdminEmailNotification';
import { supabase } from '../lib/supabase';
import { Community } from '../types';

interface CommunityManagementProps {
  userId?: string;
  onCommunityUpdate?: () => void;
}

export const CommunityManagement: React.FC<CommunityManagementProps> = ({ userId, onCommunityUpdate }) => {
  const { loading: communitiesLoading, communities, refetch, deleteCommunity } = useManagedCommunities(userId);
  const { generateAccessCode } = useCommunities();
  const { sendAdminCommunityEmail } = useAdminEmailNotification();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);

  // Check if user is assigned to any org community - if so, they cannot create new communities
  const isOrgCommunityManager = communities.some((c: any) => c.organization_id);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    access_code: generateAccessCode(),
    membership_tier: 'silver' as 'silver' | 'gold',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (editingCommunity) {
        const { error: updateError } = await supabase
          .from('communities')
          .update({
            name: formData.name,
            description: formData.description,
            access_code: formData.access_code,
            membership_tier: formData.membership_tier,
            is_active: formData.is_active,
          })
          .eq('id', editingCommunity.id);

        if (updateError) throw updateError;
      } else {
        const { data: communityData, error: createError } = await supabase
          .from('communities')
          .insert([
            {
              ...formData,
              created_by_manager_id: userId,
            },
          ])
          .select()
          .single();

        if (createError) throw createError;

        const { error: assignError } = await supabase
          .from('community_managers')
          .insert([
            {
              user_id: userId,
              community_id: communityData.id,
              created_by: userId,
            },
          ]);

        if (assignError) throw assignError;

        // Notify admin via email that a new community has been created
        await sendAdminCommunityEmail(communityData.id, communityData.name, userId);

        // Show success message - invoice will be generated overnight by nightly job
        setSuccessMessage('Community created successfully. Initial invoice will be generated overnight.');
      }

      await refetch();
      onCommunityUpdate?.();
      setShowCreateForm(false);
      setEditingCommunity(null);
      setFormData({
        name: '',
        description: '',
        access_code: generateAccessCode(),
        membership_tier: 'silver',
        is_active: true,
      });
      // Clear success message after 5 seconds
      if (successMessage) {
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save community');
      setSuccessMessage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (community: Community) => {
    setEditingCommunity(community);
    setFormData({
      name: community.name,
      description: community.description,
      access_code: community.access_code,
      membership_tier: community.membership_tier,
      is_active: community.is_active,
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (communityId: string, communityName: string) => {
    return;
    const confirmed = window.confirm(`Are you sure you want to delete "${communityName}"?`)
    if (!confirmed) return

    try {
      setLoading(true)
      await deleteCommunity(communityId)
      await refetch()
    } catch (err) {
      console.error(err)
      setError('Failed to delete community')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateNewCode = () => {
    setFormData({ ...formData, access_code: generateAccessCode() });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-[#363f49]">My Communities</h2>
          <p className="text-gray-600">
            {isOrgCommunityManager
              ? 'Manage your assigned communities'
              : 'Create and manage your communities'}
          </p>
        </div>
        {(!communitiesLoading && !isOrgCommunityManager) && (
          <button
            onClick={() => {
              setEditingCommunity(null);
              setFormData({
                name: '',
                description: '',
                access_code: generateAccessCode(),
                membership_tier: 'silver',
                is_active: true,
              });
              setShowCreateForm(true);
            }}
            className="flex items-center space-x-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Community</span>
          </button>
        )}
      </div>

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {communitiesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {communities.map((community) => (
            <div key={community.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#363f49] mb-1">{community.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{community.description}</p>
                </div>
                <button
                  onClick={() => handleEdit(community)}
                  className="ml-2 p-2 text-brand-primary hover:bg-brand-beige-light rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  disabled
                  onClick={() => handleDelete(community.id, community.name)}
                  className="ml-2 p-2 text-red-700 hover:bg-brand-beige-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Members</span>
                  </div>
                  <span className="text-sm font-semibold text-[#363f49]">{community.member_count || 0}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Key className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Access Code</span>
                  </div>
                  <code className="text-sm font-mono font-semibold text-brand-primary">
                    {community.access_code}
                  </code>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Tier</span>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${community.membership_tier === 'gold'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-200 text-gray-700'
                      }`}
                  >
                    {community.membership_tier.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Status</span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${community.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                  >
                    {community.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(communities.length === 0 && !showCreateForm && !communitiesLoading) && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#363f49] mb-2">No communities yet</h3>
          <p className="text-gray-600 mb-4">Create your first community to get started</p>
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingCommunity ? 'Edit Community' : 'Create New Community'}
              </h2>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Community Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Code <span className="text-red-500">*</span>
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.access_code}
                      onChange={(e) => setFormData({ ...formData, access_code: e.target.value.toUpperCase() })}
                      maxLength={6}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary font-mono uppercase"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleGenerateNewCode}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold text-sm"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Membership Tier <span className="text-red-500">*</span>
                  </label>
                  <select
                    disabled={!!editingCommunity}
                    value={formData.membership_tier}
                    onChange={(e) => setFormData({ ...formData, membership_tier: e.target.value as 'silver' | 'gold' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="silver">Silver - Basic Access</option>
                    <option value="gold">Gold - Premium Access</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">Community is active</label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingCommunity(null);
                      setError(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors uppercase font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : editingCommunity ? 'Update' : 'Create'} Community
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
