import { Building2, Loader2, TrendingUp, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useOrganization } from '../hooks/useOrganization';
import { useOrganizationCommunities } from '../hooks/useOrganizationCommunities';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { OrganizationCommunityManagement } from './OrganizationCommunityManagement';
import { OrganizationInvoices } from './OrganizationInvoices';
import { OrganizationUserManagement } from './OrganizationUserManagement';

export const OrganizationManagerDashboard: React.FC = () => {
  const { organization, loading: orgLoading } = useOrganization();
  const { communities, loading: communitiesLoading } = useOrganizationCommunities();

  const [activeTab, setActiveTab] = useState<'overview' | 'communities' | 'users' | 'analytics' | 'invoices'>('overview');
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | undefined>();

  useEffect(() => {
    if (communities.length > 0 && !selectedCommunityId) {
      setSelectedCommunityId(communities[0].id);
    }
  }, [communities, selectedCommunityId]);

  if (orgLoading || communitiesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center text-center min-h-screen">
        <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-[#363f49] mb-2">No Organization Found</h2>
        <p className="text-gray-600">You are not assigned to any organization. Please contact an administrator.</p>
      </div>
    );
  }

  const totalMembers = communities.reduce((sum, c) => sum + (c.member_count || 0), 0);

  return (
    <div className="space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-[#363f49]">Organization Dashboard</h1>
          <p className="text-gray-600">{organization.name}</p>
        </div>

        {activeTab === 'analytics' && communities.length > 0 && (
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
        )}
      </div>

      {/* Tabs */}
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
            Users
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
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Total Communities</p>
                  <p className="text-3xl font-bold text-[#363f49]">{communities.length}</p>
                </div>
                <Building2 className="h-8 w-8 text-brand-primary" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Total Members</p>
                  <p className="text-3xl font-bold text-blue-600">{totalMembers}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </div>



            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">Active Communities</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {communities.filter(c => c.is_active).length}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Communities List */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-brand-primary" />
              Your Communities
            </h3>
            <div className="space-y-3">
              {communities.slice(0, 5).map((community) => (
                <div key={community.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#363f49]">{community.name}</p>
                    <p className="text-xs text-gray-500">
                      {community.member_count || 0} members • {community.membership_tier.toUpperCase()} tier
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${community.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                  >
                    {community.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              ))}
              {communities.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No communities yet. Go to the Communities tab to create one.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Communities Tab */}
      {activeTab === 'communities' && <OrganizationCommunityManagement />}

      {/* Users Tab */}
      {activeTab === 'users' && <OrganizationUserManagement />}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && selectedCommunityId && (
        <AnalyticsDashboard communityId={selectedCommunityId} />
      )}

      {activeTab === 'analytics' && !selectedCommunityId && (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
          No communities available. Create a community first to view analytics.
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && <OrganizationInvoices />}
    </div>
  );
};
