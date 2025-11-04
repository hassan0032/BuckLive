import React from 'react';
import { useCommunityAnalytics } from '../hooks/useCommunityAnalytics';
import { BarChart3, TrendingUp, Clock, Eye, User } from 'lucide-react';

interface AnalyticsDashboardProps {
  communityId: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ communityId }) => {
  const { analytics, anonymousAnalytics, loading } = useCommunityAnalytics(communityId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#363f49]">Analytics Dashboard</h2>
        <p className="text-gray-600">Detailed engagement metrics and user activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Content Views</h3>
            <Eye className="h-5 w-5 text-brand-primary" />
          </div>
          <p className="text-3xl font-bold text-[#363f49]">{analytics.totalViews}</p>
          <p className="text-xs text-gray-500 mt-1">All time</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Active Users Today</h3>
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-[#363f49]">{analytics.activeUsersToday}</p>
          <p className="text-xs text-gray-500 mt-1">Out of {analytics.totalUsers} total</p>
        </div>

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
          <p className="text-xs text-gray-500 mt-1">Users active today</p>
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
                  <p className="text-sm font-medium text-[#363f49] truncate">{content.title}</p>
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
            <User className="h-5 w-5 mr-2 text-brand-primary" />
            User Activity Summary
          </h3>
          <div className="space-y-3">
            {analytics.userActivity.slice(0, 8).map((activity) => (
              <div key={activity.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#363f49] truncate">
                    {activity.first_name} {activity.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{activity.email}</p>
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

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-brand-primary" />
          Recent Content Views
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Viewed At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.recentViews.slice(0, 10).map((view) => (
                <tr key={view.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                  {view.user_name} <span className='text-xs'>({view.user_email})</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {/* {analytics.topContent.find(c => c.content_id === view.content_id)?.title || (view.content_id ? `${view.content_id.slice(0, 8)}...` : 'N/A')} */}
                    {
                    analytics.topContent.find(c => c.content_id === view.content_id)?.title 
                    }
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {Math.floor(view.view_duration / 60)}m {view.view_duration % 60}s
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(view.viewed_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {analytics.recentViews.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No recent views</p>
            </div>
          )}
        </div>
      </div>



      <h2 className="text-2xl font-semibold text-[#363f49] mt-8">Anonymous User Analytics</h2>
      <p className="text-gray-600 mb-6">Analytics for users accessing content via public share links</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Content Views</h3>
            <Eye className="h-5 w-5 text-brand-primary" />
          </div>
          <p className="text-3xl font-bold text-[#363f49]">{anonymousAnalytics.totalViews}</p>
          <p className="text-xs text-gray-500 mt-1">All time from public links</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Engagement Rate</h3>
            <BarChart3 className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-[#363f49]">
            {anonymousAnalytics.engagementRate}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Views active today</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
        <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-brand-primary" />
          Most Popular Content (Anonymous Users)
        </h3>
        <div className="space-y-3">
          {anonymousAnalytics.topContent.map((content, index) => (
            <div key={content.content_id} className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-beige-light flex items-center justify-center">
                <span className="text-sm font-semibold text-brand-primary">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#363f49] truncate">{content.title}</p>
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
          {anonymousAnalytics.topContent.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No anonymous content views yet</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
        <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-brand-primary" />
          Recent Content Views by Anonymous Users
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Viewed At
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {anonymousAnalytics.recentViews.slice(0, 10).map((view) => (
                <tr key={view.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {view.user_name || 'Anonymous User'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {anonymousAnalytics.topContent.find(c => c.content_id === view.content_id)?.title || (view.content_id ? `${view.content_id.slice(0, 8)}...` : 'N/A')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {Math.floor((view.view_duration || 0) / 60)}m {(view.view_duration || 0) % 60}s
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(view.viewed_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {anonymousAnalytics.recentViews.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No recent anonymous views</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
