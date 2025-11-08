import { BarChart3, Building2, Check, Clock, Copy, Eye, Link2, Plus, RefreshCw, TrendingUp, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCommunityAnalytics } from '../hooks/useCommunityAnalytics';
import { useManagedCommunities } from '../hooks/useManagedCommunities';
import { supabase } from '../lib/supabase';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { CommunityManagement } from './CommunityManagement';
import CommunityManagerInvoices from './CommunityManagerInvoices';
import { UserManagement } from './UserManagement';

export const CommunityManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { communities, loading: communitiesLoading, refetch } = useManagedCommunities(user?.id);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'analytics' | 'communities' | 'invoices'>('overview');

  const { analytics } = useCommunityAnalytics(selectedCommunityId);

  useEffect(() => {
    if (communities.length > 0 && !selectedCommunityId) {
      setSelectedCommunityId(communities[0].id);
    }
  }, [communities, selectedCommunityId]);

  const selectedCommunity = communities.find(c => c.id === selectedCommunityId);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [updatingShareLink, setUpdatingShareLink] = useState(false);

  const generateShareToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleToggleShareLink = async (enabled: boolean) => {
    if (!selectedCommunityId) return;

    setUpdatingShareLink(true);
    try {
      const updateData: any = { is_sharable: enabled };
      if (enabled && !selectedCommunity?.sharable_token) {
        updateData.sharable_token = generateShareToken();
      }

      const { error } = await supabase
        .from('communities')
        .update(updateData)
        .eq('id', selectedCommunityId);

      if (error) throw error;

      await refetch();
    } catch (err) {
      console.error('Error updating share link:', err);
      alert('Failed to update share link. Please try again.');
    } finally {
      setUpdatingShareLink(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!selectedCommunityId) return;

    setUpdatingShareLink(true);
    try {
      const { error } = await supabase
        .from('communities')
        .update({ sharable_token: generateShareToken() })
        .eq('id', selectedCommunityId);

      if (error) throw error;

      await refetch();
    } catch (err) {
      console.error('Error regenerating token:', err);
      alert('Failed to regenerate token. Please try again.');
    } finally {
      setUpdatingShareLink(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!selectedCommunity?.sharable_token) return;

    const shareLink = `${window.location.origin}/public/${selectedCommunity.sharable_token}`;
    navigator.clipboard.writeText(shareLink).then(() => {
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    });
  };

  if (communitiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center min-h-screen">

        <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-[#363f49] mb-2">No Communities Yet</h2>
        <p className="text-gray-600 mb-6">Create your first community to get started managing users and content.</p>
        <button
          onClick={() => setActiveTab('communities')}
          className="inline-flex items-center space-x-2 bg-brand-primary text-white px-6 py-3 rounded-lg hover:bg-brand-d-blue transition-colors uppercase font-semibold text-sm"
        >
          <Plus className="h-5 w-5" />
          <span>Create Community</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-screen">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-[#363f49]">Community Manager Dashboard</h1>
          <p className="text-gray-600">Manage your communities, users, and track engagement</p>
        </div>

        <div className="w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Community</label>
          <select
            value={selectedCommunityId || ''}
            onChange={(e) => setSelectedCommunityId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
          >
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name} ({community.member_count || 0} members)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Share Link Management */}
      {selectedCommunity && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
            <Link2 className="h-5 w-5 mr-2 text-brand-primary" />
            Public Share Link
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">
                  Allow anonymous users to view your community's content without logging in.
                </p>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCommunity.is_sharable || false}
                    onChange={(e) => handleToggleShareLink(e.target.checked)}
                    disabled={updatingShareLink}
                    className="sr-only"
                  />
                  <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${(selectedCommunity.is_sharable || false) ? 'bg-brand-primary' : 'bg-gray-300'
                    } ${updatingShareLink ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(selectedCommunity.is_sharable || false) ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    {selectedCommunity.is_sharable ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>

            {selectedCommunity.is_sharable && selectedCommunity.sharable_token && (
              <div className="border-t border-gray-200 pt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Share Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/public/${selectedCommunity.sharable_token}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                    />
                    <button
                      onClick={handleCopyShareLink}
                      className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors text-sm font-medium"
                    >
                      {shareLinkCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <button
                    onClick={handleRegenerateToken}
                    disabled={updatingShareLink}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${updatingShareLink ? 'animate-spin' : ''}`} />
                    Regenerate Token
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Regenerating the token will invalidate the current share link. You'll need to share the new link.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-semibold text-sm uppercase ${activeTab === 'overview'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Overview
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
            onClick={() => setActiveTab('communities')}
            className={`py-2 px-1 border-b-2 font-semibold text-sm uppercase ${activeTab === 'communities'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Communities
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-2 px-1 border-b-2 font-semibold text-sm uppercase ${activeTab === 'invoices'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <span className="inline-flex items-center gap-2">Invoices</span>
          </button>
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-[#363f49]">{analytics.totalUsers}</p>
                </div>
                <Users className="h-8 w-8 text-brand-primary" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Active Today</p>
                  <p className="text-3xl font-bold text-blue-600">{analytics.activeUsersToday}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Content Views</p>
                  <p className="text-3xl font-bold text-green-600">{analytics.totalViews}</p>
                </div>
                <Eye className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Avg. Session</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {Math.floor(analytics.averageSessionDuration / 60)}m
                  </p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-brand-primary" />
                Top Content
              </h3>
              <div className="space-y-3">
                {analytics.topContent.slice(0, 5).map((content) => (
                  <div key={content.content_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#363f49] truncate">{content.title}</p>
                      <p className="text-xs text-gray-500">
                        {content.view_count} views • {Math.floor(content.total_duration / 60)} min total
                      </p>
                    </div>
                  </div>
                ))}
                {analytics.topContent.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No content views yet</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-brand-primary" />
                Recent User Activity
              </h3>
              <div className="space-y-3">
                {analytics.userActivity.slice(0, 5).map((activity) => (
                  <div key={activity.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#363f49]">
                        {activity.first_name} {activity.last_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{activity.email}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-gray-500">
                        {activity.login_count} {activity.login_count === 1 ? 'login' : 'logins'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {activity.last_login !== 'Never'
                          ? new Date(activity.last_login).toLocaleDateString()
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                ))}
                {analytics.userActivity.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No user activity yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && selectedCommunityId && (
        <UserManagement communityId={selectedCommunityId} communityName={selectedCommunity?.name || ''} />
      )}

      {activeTab === 'analytics' && selectedCommunityId && (
        <AnalyticsDashboard communityId={selectedCommunityId} />
      )}

      {activeTab === 'communities' && (
        <CommunityManagement userId={user?.id} onCommunityUpdate={refetch} />
      )}

      {activeTab === 'invoices' && (
        <CommunityManagerInvoices />
      )}

    </div>
  );
};
