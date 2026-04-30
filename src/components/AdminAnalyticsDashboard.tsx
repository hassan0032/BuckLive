import React, { useState } from 'react';
import { useSystemAnalytics } from '../hooks/useSystemAnalytics';
import { useCommunities } from '../hooks/useCommunities';
import { BarChart3, TrendingUp, Clock, Eye, User, Building2, Users, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminAnalyticsDashboard: React.FC = () => {
  const [communityFilter, setCommunityFilter] = useState<string>('');
  const { analytics, loading } = useSystemAnalytics(communityFilter || undefined);
  const { communities } = useCommunities();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-semibold text-[#363f49]">Analytics Dashboard</h2>
          <p className="text-gray-600">
            {communityFilter ? 'Community-specific' : 'Platform-wide'} engagement metrics and insights
          </p>
        </div>
        <div className="w-64">
          <select
            value={communityFilter}
            onChange={(e) => setCommunityFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
          >
            <option value="">All Communities</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Content Views</h3>
            <Eye className="h-5 w-5 text-brand-primary" />
          </div>
          <p className="text-3xl font-bold text-[#363f49]">{analytics.totalViews}</p>
          <p className="text-xs text-gray-500 mt-1">All time</p>
        </div>

        {/* <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Active Users Today</h3>
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-[#363f49]">{analytics.activeUsersToday}</p>
          <p className="text-xs text-gray-500 mt-1">Out of {analytics.totalUsers} total</p>
        </div> */}

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Avg. Session Time</h3>
            <Clock className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-[#363f49]">
            {Math.floor(analytics.averageSessionDuration / 60)}m
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {analytics.averageSessionDuration % 60}s average
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Engagement Rate</h3>
            <BarChart3 className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-[#363f49]">
            {analytics.totalUsers > 0
              ? Math.round((analytics.activeUsersToday / analytics.totalUsers) * 100)
              : 0}
            %
          </p>
          <p className="text-xs text-gray-500 mt-1">Unique viewers / total views</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-4">Users by Role</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center mr-3">
                  <Award className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-sm text-gray-700">Admins</span>
              </div>
              <span className="text-lg font-semibold text-[#363f49]">{analytics.usersByRole.admin}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm text-gray-700">Organization Managers</span>
              </div>
              <span className="text-lg font-semibold text-[#363f49]">{analytics.usersByRole.organizationManager}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm text-gray-700">Community Managers</span>
              </div>
              <span className="text-lg font-semibold text-[#363f49]">{analytics.usersByRole.communityManager}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <User className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-sm text-gray-700">Members</span>
              </div>
              <span className="text-lg font-semibold text-[#363f49]">{analytics.usersByRole.member}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-4">Users by Tier</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center mr-3">
                  <Award className="h-4 w-4 text-yellow-600" />
                </div>
                <span className="text-sm text-gray-700">Gold</span>
              </div>
              <span className="text-lg font-semibold text-[#363f49]">{analytics.usersByTier.gold}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                  <Award className="h-4 w-4 text-gray-600" />
                </div>
                <span className="text-sm text-gray-700">Silver</span>
              </div>
              <span className="text-lg font-semibold text-[#363f49]">{analytics.usersByTier.silver}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <span className="text-sm text-gray-700">No Tier</span>
              </div>
              <span className="text-lg font-semibold text-[#363f49]">{analytics.usersByTier.none}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-4">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Total Users</span>
              <span className="text-lg font-semibold text-[#363f49]">{analytics.totalUsers}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Content Views</span>
              <span className="text-lg font-semibold text-[#363f49]">{analytics.totalViews}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Communities</span>
              <span className="text-lg font-semibold text-[#363f49]">
                {communityFilter ? 1 : communities.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-brand-primary" />
            Most Popular Content
          </h3>
          <div className="space-y-3">
            {analytics.topContent.map((content, index) => (
              <div key={content.content_id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-beige-light flex items-center justify-center">
                  <span className="text-sm font-semibold text-brand-primary">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/content/${content.content_id}`}>
                    <p className="text-sm font-medium text-[#363f49] truncate">{content.title}</p>
                  </Link>
                  <div className="flex items-center space-x-4 mt-1">
                    <div className="flex items-center text-xs text-gray-500">
                      <Eye className="h-3 w-3 mr-1" />
                      {content.view_count} views
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {Math.floor(content.total_duration / 60)} min total
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {analytics.topContent.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No content views yet</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-brand-primary" />
            Most Active Users
          </h3>
          <div className="space-y-3">
            {analytics.userActivity.slice(0, 8).map((activity) => (
              <div key={activity.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#363f49] truncate">
                    {activity.first_name} {activity.last_name}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <p className="text-xs text-gray-500 truncate">{activity.email}</p>
                    <span className="text-xs text-gray-400">•</span>
                    <p className="text-xs text-gray-500">{activity.community_name}</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-xs font-medium text-[#363f49]">
                    {activity.login_count} {activity.login_count === 1 ? 'login' : 'logins'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {activity.last_login !== 'Never'
                      ? new Date(activity.last_login).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            ))}
            {analytics.userActivity.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">No user activity yet</p>
            )}
          </div>
        </div>
      </div>

      {!communityFilter && analytics.communityPerformance.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
            <Building2 className="h-5 w-5 mr-2 text-brand-primary" />
            Community Performance Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Community
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Members
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Today
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Views
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Session
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engagement
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.communityPerformance
                  .sort((a, b) => b.engagement_rate - a.engagement_rate)
                  .map((community) => (
                    <tr key={community.community_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-[#363f49]">
                        {community.community_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {community.member_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {community.active_users_today}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {community.total_views}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {Math.floor(community.avg_session_duration / 60)}m
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-brand-primary rounded-full h-2"
                              style={{ width: `${community.engagement_rate}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-[#363f49]">
                            {community.engagement_rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-brand-primary" />
          Recent Platform Activity
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Content
                </th>
                {!communityFilter && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Community
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Viewed At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.recentViews.slice(0, 15).map((view) => {
                const community = communities.find(c => c.id === view.community_id);
                return (
                  <tr key={view.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {`${view.user_profiles?.first_name || ''} ${view.user_profiles?.last_name || ''}`.trim() || 'Anonymous User'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <Link to={`/content/${view.content_id}`}>
                        {view.content?.title || ''}
                      </Link>
                    </td>
                    {!communityFilter && (
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {community?.name || 'N/A'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {Math.floor(view.view_duration / 60)}m {view.view_duration % 60}s
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(view.viewed_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {analytics.recentViews.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No recent views</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
