import { Key, Loader2, Plus, Shield, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useCommunities } from '../hooks/useCommunities';
import { useOrganizationCommunities } from '../hooks/useOrganizationCommunities';
import { Community, PaymentTier } from '../types';



export const OrganizationCommunityManagement: React.FC = () => {
  const {
    communities,
    loading,
    addCommunity,
    refetch
  } = useOrganizationCommunities();
  const { generateAccessCode } = useCommunities();

  const [showCreateForm, setShowCreateForm] = useState(false);



  const [formData, setFormData] = useState({
    name: '',
    description: '',
    access_code: '',
    membership_tier: 'silver' as PaymentTier,
    is_active: true,
  });


  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      access_code: generateAccessCode(),
      membership_tier: 'silver',
      is_active: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);

    try {
      const result = await addCommunity(formData as any);
      if (result.error) throw new Error(result.error);
      setShowCreateForm(false);
      resetForm();
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create community');
    } finally {
      setActionLoading(false);
    }
  };



  const handleGenerateNewCode = () => {
    setFormData({ ...formData, access_code: generateAccessCode() });
  };

  useEffect(() => {
    resetForm();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-[#363f49]">Communities</h2>
          <p className="text-gray-600">Manage communities under your organization</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateForm(true);
          }}
          className="flex items-center space-x-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Create Community</span>
        </button>
      </div>

      {loading ? (
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

      {communities.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#363f49] mb-2">No communities yet</h3>
          <p className="text-gray-600 mb-4">Create your first community to get started</p>
        </div>
      )}

      {/* Create Community Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Create New Community</h2>

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
                    value={formData.membership_tier}
                    onChange={(e) => setFormData({ ...formData, membership_tier: e.target.value as PaymentTier })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
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
                      setError(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors uppercase font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm disabled:opacity-50"
                  >
                    {actionLoading ? 'Creating...' : 'Create Community'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}