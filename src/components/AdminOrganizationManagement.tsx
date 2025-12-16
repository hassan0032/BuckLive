import { Building2, Edit, Loader2, Trash2, Users, Eye } from 'lucide-react';
import React, { useState } from 'react';
import { DeleteConfirmationModal } from './common/DeleteConfirmationModal';
import { AdminOrganization, useAdminOrganizations } from '../hooks/useAdminOrganizations';
import { Community } from '../types';

export const AdminOrganizationManagement: React.FC = () => {
  const {
    organizations,
    loading,
    updateOrganization,
    deleteOrganization,
    addOrganization,
  } = useAdminOrganizations();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<AdminOrganization | null>(null);

  // Communities Modal State
  const [showCommunitiesModal, setShowCommunitiesModal] = useState(false);
  const [selectedOrgCommunities, setSelectedOrgCommunities] = useState<Community[]>([]);
  const [selectedOrgName, setSelectedOrgName] = useState('');

  // Form for creating new org + manager
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
  });

  // Form for editing org
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [orgToDelete, setOrgToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingOrg, setDeletingOrg] = useState(false);

  const resetCreateForm = () => {
    setCreateFormData({
      name: '',
      description: '',
    });
    setFormError(null);
  };

  const handleEdit = (org: AdminOrganization) => {
    setEditingOrg(org);
    setEditFormData({
      name: org.name,
      description: org.description || '',
    });
    setShowEditForm(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    setOrgToDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!orgToDelete) return;

    setDeletingOrg(true);
    try {
      await deleteOrganization(orgToDelete.id);
      setOrgToDelete(null);
    } catch (error) {
      alert('Failed to delete organization');
    } finally {
      setDeletingOrg(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFormError(null);

    try {
      const { error } = await addOrganization(createFormData);

      if (error) throw new Error(error);

      setShowCreateForm(false);
      resetCreateForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to create organization');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;

    setActionLoading(true);
    try {
      await updateOrganization(editingOrg.id, editFormData);
      setShowEditForm(false);
      setEditingOrg(null);
    } catch (error) {
      alert('Failed to update organization');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewCommunities = (orgName: string, communities: Community[]) => {
    setSelectedOrgName(orgName);
    setSelectedOrgCommunities(communities);
    setShowCommunitiesModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-[#363f49]">Organization Management</h2>
          <p className="text-gray-600">Create and manage organizations</p>
        </div>
        <button
          onClick={() => {
            resetCreateForm();
            setShowCreateForm(true);
          }}
          className="flex items-center space-x-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
        >
          <Building2 className="h-4 w-4" />
          <span>Add Organization</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Communities</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Managers</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-[#363f49]">{org.name}</div>
                          {org.description && (
                            <div className="text-sm text-gray-500">{org.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {org.community_count} communities
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {org.managers?.length === 0 ? (
                          <span className="text-sm text-gray-400 italic">No managers</span>
                        ) : (
                          org.managers?.map(m => (
                            <div key={m.user_id} className="text-sm text-gray-600 flex items-center">
                              <Users className="h-3 w-3 mr-1" />
                              {m.first_name} {m.last_name} ({m.email})
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(org)}
                        className="text-brand-primary hover:text-brand-d-blue inline-block"
                        title="Edit organization"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        title="Delete organization"
                        disabled
                        className="text-red-600 hover:text-red-700 inline-block disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleDeleteClick(org.id, org.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        title="View organization communities"
                        className="text-black-600 hover:text-black-700 inline-block cursor-pointer"
                        onClick={() => handleViewCommunities(org.name, org.communities || [])}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {organizations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No organizations found. Click "Add Organization" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Organization Manager Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Add Organization</h3>
            <p className="text-sm text-gray-600 mb-4">
              Create a new organization. You can assign managers later in the User Management tab.
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter organization name"
                  value={createFormData.name}
                  onChange={e => setCreateFormData({ ...createFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Optional description"
                  value={createFormData.description}
                  onChange={e => setCreateFormData({ ...createFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetCreateForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      {showEditForm && editingOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Edit Organization</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingOrg(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Communities List Modal */}
      {showCommunitiesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">
                Communities in {selectedOrgName}
              </h3>
              <button
                onClick={() => setShowCommunitiesModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedOrgCommunities.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500 italic">No communities found in this organization.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Access Code</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Billing Code</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedOrgCommunities.map((community) => (
                      <tr key={community.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          {community.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {community.access_code}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${community.membership_tier === 'gold'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                              }`}
                          >
                            {community.membership_tier.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${community.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                              }`}
                          >
                            {community.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {community.code}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(community.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowCommunitiesModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <DeleteConfirmationModal
        isOpen={!!orgToDelete}
        onClose={() => setOrgToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Organization"
        message={`Are you sure you want to delete organization "${orgToDelete?.name}"? This will remove all manager assignments. Communities will remain but become standalone.`}
        isDeleting={deletingOrg}
      />
    </div>
  );
};
