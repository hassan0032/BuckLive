import { BarChart3, Edit, FileText, Image as ImageIcon, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { useCommunities } from '../hooks/useCommunities';
import { useContent } from '../hooks/useContent';
import { Community, Content, CONTENT_STATUS, PAYMENT_TIER, PaymentTier } from '../types';
import { AdminAnalyticsDashboard } from './AdminAnalyticsDashboard';
import { AdminUserManagement } from './AdminUserManagement';
import { EnhancedContentForm } from './EnhancedContentForm';
import Invoices from './Invoices';
import AdminNotifications from './AdminNotifications';

interface CommunityFormData {
  name: string;
  description: string;
  access_code: string;
  is_active: boolean;
  membership_tier: 'silver' | 'gold';
}

export const AdminDashboard: React.FC = () => {
  const { content, addContent, updateContent, deleteContent } = useContent();
  const { loading: communitiesLoading, communities, addCommunity, updateCommunity, deleteCommunity } = useCommunities();
  const [showForm, setShowForm] = useState(false);
  const [showCommunityForm, setShowCommunityForm] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [editingCommunity, setEditingCommunity] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'content' | 'communities' | 'users' | 'analytics' | 'invoices' | 'notifications'>('content');

  const [communityFormData, setCommunityFormData] = useState<CommunityFormData>({
    name: '',
    description: '',
    access_code: '',
    is_active: true,
    membership_tier: PAYMENT_TIER.SILVER as PaymentTier,
  });

  const handleContentSubmit = async (contentData: Content, isDraft: boolean) => {
    try {
      let result;
      if (editingContent) {
        result = await updateContent(editingContent.id, contentData);
      } else {
        result = await addContent(contentData);
      }

      if (result.error) {
        alert(`Failed to save content: ${result.error}`);
        return;
      }

      setShowForm(false);
      setEditingContent(null);

      // Show success message
      const action = editingContent ? 'updated' : 'created';
      const status = isDraft ? CONTENT_STATUS.DRAFT : CONTENT_STATUS.PUBLISHED;
      alert(`Content ${action} successfully as ${status.toUpperCase()}!`);
    } catch (error) {
      console.error('Error submitting content:', error);
      alert(`Failed to save content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCommunitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCommunity) {
      await updateCommunity(editingCommunity, communityFormData);
    } else {
      await addCommunity(communityFormData);
    }

    setShowCommunityForm(false);
    setEditingCommunity(null);
    setCommunityFormData({
      name: '',
      description: '',
      access_code: '',
      is_active: true,
      membership_tier: PAYMENT_TIER.SILVER as PaymentTier,
    });
  };

  const handleEdit = (item: Content) => {
    setEditingContent(item);
    setShowForm(true);
  };

  const handleEditCommunity = (community: Community) => {
    setEditingCommunity(community.id);
    setCommunityFormData({
      name: community.name,
      description: community.description,
      access_code: community.access_code,
      is_active: community.is_active,
      membership_tier: community.membership_tier,
    });
    setShowCommunityForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this content?')) {
      await deleteContent(id);
    }
  };

  const handleDeleteCommunity = async (id: string) => {
    return;
    if (confirm('Are you sure you want to delete this community? This will affect all associated users.')) {
      await deleteCommunity(id);
    }
  };

  const stats = {
    totalContent: content.length,
    videos: content.filter(c => c.type === 'video').length,
    pdfs: content.filter(c => c.type === 'pdf').length,
    blogs: content.filter(c => c.type === 'blog').length,
    communities: communities.length,
    activeCommunities: communities.filter(c => c.is_active).length,
    drafts: content.filter(c => c.status === 'draft').length,
    published: content.filter(c => c.status === 'published').length,
  };

  return (
    <div className="space-y-6 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold text-[#363f49]">Admin Dashboard</h1>
          <p className="text-gray-600">
            {activeTab === 'users' ? 'Manage all users across the platform' :
              activeTab === 'analytics' ? 'Platform-wide analytics and insights' :
                'Manage content and communities'}
          </p>
        </div>
        {(activeTab === 'content' || activeTab === 'communities') && (
          <button
            onClick={() => {
              if (activeTab === 'content') {
                setEditingContent(null);
                setShowForm(true);
              } else {
                setShowCommunityForm(true);
              }
            }}
            className="flex items-center space-x-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>{activeTab === 'content' ? 'Add Content' : 'Add Community'}</span>
          </button>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('content')}
            className={`py-2 px-1 border-b-2 font-semibold text-sm uppercase ${activeTab === 'content'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Content Management
          </button>
          <button
            onClick={() => setActiveTab('communities')}
            className={`py-2 px-1 border-b-2 font-semibold text-sm uppercase ${activeTab === 'communities'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Communities
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-semibold text-sm uppercase ${activeTab === 'users'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-1 border-b-2 font-semibold text-sm uppercase ${activeTab === 'analytics'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-2 px-1 border-b-2 font-semibold text-sm uppercase ${activeTab === 'invoices'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-2 px-1 border-b-2 font-semibold text-sm uppercase ${activeTab === 'notifications'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Notifications
          </button>
        </nav>
      </div>

      {(activeTab === 'content' || activeTab === 'communities') && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Content</p>
                <p className="text-3xl font-bold text-[#363f49]">{stats.totalContent}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-brand-primary" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Videos</p>
                <p className="text-3xl font-bold text-blue-600">{stats.videos}</p>
              </div>
              <Upload className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">PDFs</p>
                <p className="text-3xl font-bold text-brand-primary">{stats.pdfs}</p>
              </div>
              <FileText className="h-8 w-8 text-brand-primary" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Blog Posts</p>
                <p className="text-3xl font-bold text-green-600">{stats.blogs}</p>
              </div>
              <Upload className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'content' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#363f49]">Content Management</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thumbnail
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {content.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.title}
                          className="w-20 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-20 h-12 bg-gray-200 rounded flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-[#363f49]">{item.title}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {item.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${item.type === 'video'
                          ? 'bg-blue-100 text-blue-700'
                          : item.type === 'pdf'
                            ? 'bg-brand-beige-light text-brand-secondary'
                            : 'bg-green-100 text-green-700'
                          }`}
                      >
                        {item.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${item.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                          }`}
                      >
                        {(item.status || 'published').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#363f49]">{item.category}</td>
                    <td className="px-6 py-4 text-sm text-[#363f49]">{item.author}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-brand-primary hover:text-brand-d-blue inline-block"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-700 inline-block"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'communities' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-[#363f49]">
              Communities & Access Codes
            </h2>
            <button
              onClick={() => setShowCommunityForm(true)}
              className="flex items-center space-x-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Community</span>
            </button>
          </div>

          {communitiesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Access Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {communities.map((community) => (
                    <tr key={community.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-[#363f49]">{community.name}</div>
                        <div className="text-sm text-gray-500">{community.description}</div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {community.access_code}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${community.membership_tier === 'gold'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                            }`}
                        >
                          {community.membership_tier.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${community.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                            }`}
                        >
                          {community.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(community.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleEditCommunity(community)}
                          className="text-brand-primary hover:text-brand-d-blue inline-block"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          disabled
                          onClick={() => handleDeleteCommunity(community.id)}
                          className="text-red-600 hover:text-red-700 inline-block disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && <AdminUserManagement />}

      {activeTab === 'analytics' && <AdminAnalyticsDashboard />}

      {activeTab === 'invoices' && <Invoices />}

      {activeTab === 'notifications' && <AdminNotifications />}

      {showForm && (
        <EnhancedContentForm
          editingContent={editingContent}
          onClose={() => {
            setShowForm(false);
            setEditingContent(null);
          }}
          onSubmit={handleContentSubmit}
        />
      )}

      {showCommunityForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {editingCommunity ? 'Edit Community' : 'Add New Community'}
              </h2>

              <form onSubmit={handleCommunitySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={communityFormData.name}
                    onChange={(e) =>
                      setCommunityFormData({ ...communityFormData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={communityFormData.description}
                    onChange={(e) =>
                      setCommunityFormData({
                        ...communityFormData,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Code
                  </label>
                  <input
                    type="text"
                    value={communityFormData.access_code}
                    onChange={(e) =>
                      setCommunityFormData({
                        ...communityFormData,
                        access_code: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Membership Tier
                  </label>
                  <select
                    disabled={!!editingCommunity}
                    value={communityFormData.membership_tier}
                    onChange={(e) =>
                      setCommunityFormData({
                        ...communityFormData,
                        membership_tier: e.target.value as PaymentTier,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  >
                    <option value={PAYMENT_TIER.SILVER}>{PAYMENT_TIER.SILVER.toUpperCase()}</option>
                    <option value={PAYMENT_TIER.GOLD}>{PAYMENT_TIER.GOLD.toUpperCase()}</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={communityFormData.is_active}
                    onChange={(e) =>
                      setCommunityFormData({
                        ...communityFormData,
                        is_active: e.target.checked,
                      })
                    }
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">Active</label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCommunityForm(false);
                      setEditingCommunity(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors uppercase font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
                  >
                    {editingCommunity ? 'Update' : 'Add'} Community
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
