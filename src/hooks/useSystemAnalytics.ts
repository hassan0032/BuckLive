import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ContentView, PAYMENT_TIER, ROLE } from '../types';

interface CommunityPerformance {
  community_id: string;
  community_name: string;
  member_count: number;
  active_users_today: number;
  total_views: number;
  avg_session_duration: number;
  engagement_rate: number;
}

interface EnrichedContentView extends ContentView {
  user_profiles?: {
    first_name: string | null;
    last_name: string | null;
  };
  content?: {
    title: string | null;
  };
}

interface SystemAnalyticsData {
  totalViews: number;
  totalUsers: number;
  activeUsersToday: number;
  averageSessionDuration: number;
  topContent: Array<{
    content_id: string;
    title: string;
    view_count: number;
    total_duration: number;
  }>;
  userActivity: Array<{
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    community_name: string;
    last_login: string;
    login_count: number;
  }>;
  recentViews: EnrichedContentView[];
  communityPerformance: CommunityPerformance[];
  usersByRole: {
    admin: number;
    organizationManager: number;
    communityManager: number;
    member: number;
  };
  usersByTier: {
    silver: number;
    gold: number;
    none: number;
  };
}

export const useSystemAnalytics = (communityFilter?: string) => {
  const [analytics, setAnalytics] = useState<SystemAnalyticsData>({
    totalViews: 0,
    totalUsers: 0,
    activeUsersToday: 0,
    averageSessionDuration: 0,
    topContent: [],
    userActivity: [],
    recentViews: [],
    communityPerformance: [],
    usersByRole: { admin: 0, organizationManager: 0, communityManager: 0, member: 0 },
    usersByTier: { silver: 0, gold: 0, none: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      let usersQuery = supabase
        .from('user_profiles')
        .select(`
          *,
          communities:user_profiles_community_id_fkey(*)
        `)

      if (communityFilter) {
        usersQuery = usersQuery.eq('community_id', communityFilter);
      }

      const { data: users } = await usersQuery;

      const userIds = users?.map(u => u.id) || [];
      const totalUsers = users?.length || 0;

      const usersByRole = {
        admin: users?.filter(u => u.role === ROLE.ADMIN).length || 0,
        organizationManager: users?.filter(u => u.role === ROLE.ORGANIZATION_MANAGER).length || 0,
        communityManager: users?.filter(u => u.role === ROLE.COMMUNITY_MANAGER).length || 0,
        member: users?.filter(u => u.role === ROLE.MEMBER).length || 0,
      };

      const usersByTier = {
        silver: users?.filter(u => u.communities?.membership_tier === PAYMENT_TIER.SILVER).length || 0,
        gold: users?.filter(u => u.communities?.membership_tier === PAYMENT_TIER.GOLD).length || 0,
        none: users?.filter(u => !u.communities?.membership_tier).length || 0,
      };

      let viewsCountQuery = supabase
        .from('content_views')
        .select('*', { count: 'exact', head: true });

      if (communityFilter) {
        viewsCountQuery = viewsCountQuery.eq('community_id', communityFilter);
      }

      const { count: totalViewsCount, error: viewsCountError } = await viewsCountQuery;

      if (viewsCountError) throw viewsCountError;

      let viewsQuery = supabase
        .from('content_views')
        .select(`
        *,
        user_profiles!content_views_user_id_fkey (
          first_name,
          last_name
        ),
        content!content_views_content_id_fkey (
          title
        )
      `)
        .order('viewed_at', { ascending: false })
        .limit(100);

      if (communityFilter) {
        viewsQuery = viewsQuery.eq('community_id', communityFilter);
      }

      const { data: views, error: viewsError } = await viewsQuery;

      if (viewsError) throw viewsError;

      const totalViews = totalViewsCount || 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];

      // Calculate active users from content views instead of user sessions
      let todayViewsQuery = supabase
        .from('content_views')
        .select('user_id')
        .gte('viewed_at', todayISO);

      if (communityFilter) {
        todayViewsQuery = todayViewsQuery.eq('community_id', communityFilter);
      }

      const { data: todayViews } = await todayViewsQuery;

      const activeUsersToday = new Set(todayViews?.map(v => v.user_id) || []).size;

      // Calculate average duration from all content views
      let allViewsDurationQuery = supabase
        .from('content_views')
        .select('view_duration')
        .not('view_duration', 'is', null);

      if (communityFilter) {
        allViewsDurationQuery = allViewsDurationQuery.eq('community_id', communityFilter);
      }

      const { data: allViewsDuration } = await allViewsDurationQuery;

      const avgDuration = allViewsDuration && allViewsDuration.length > 0
        ? allViewsDuration.reduce((sum, v) => sum + (v.view_duration || 0), 0) / allViewsDuration.length
        : 0;

      // Fetch ALL views for accurate top content calculation (not just recent 100)
      let allViewsQuery = supabase
        .from('content_views')
        .select('content_id, view_duration');

      if (communityFilter) {
        allViewsQuery = allViewsQuery.eq('community_id', communityFilter);
      }

      const { data: allViewsData } = await allViewsQuery;

      const contentViewMap = new Map<string, { count: number; duration: number }>();
      allViewsData?.forEach(view => {
        const existing = contentViewMap.get(view.content_id) || { count: 0, duration: 0 };
        contentViewMap.set(view.content_id, {
          count: existing.count + 1,
          duration: existing.duration + (view.view_duration || 0),
        });
      });

      const contentIds = Array.from(contentViewMap.keys());
      const { data: contentData } = await supabase
        .from('content')
        .select('id, title')
        .in('id', contentIds);

      const topContent = Array.from(contentViewMap.entries())
        .map(([content_id, stats]) => ({
          content_id,
          title: contentData?.find(c => c.id === content_id)?.title || 'Unknown',
          view_count: stats.count,
          total_duration: stats.duration,
        }))
        .sort((a, b) => b.view_count - a.view_count)
      // .slice(0, 10);

      const { data: userSessions } = userIds.length > 0
        ? await supabase
          .from('user_sessions')
          .select('user_id, login_at')
          .in('user_id', userIds)
          .order('login_at', { ascending: false })
        : { data: [] };

      const userLoginMap = new Map<string, { lastLogin: string; count: number }>();
      userSessions?.forEach(session => {
        const existing = userLoginMap.get(session.user_id);
        if (!existing || new Date(session.login_at) > new Date(existing.lastLogin)) {
          userLoginMap.set(session.user_id, {
            lastLogin: session.login_at,
            count: (existing?.count || 0) + 1,
          });
        } else {
          userLoginMap.set(session.user_id, {
            lastLogin: existing.lastLogin,
            count: existing.count + 1,
          });
        }
      });

      const userActivity = users?.map(user => ({
        user_id: user.id,
        email: user.email,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        community_name: user.communities?.name || 'N/A',
        last_login: userLoginMap.get(user.id)?.lastLogin || 'Never',
        login_count: userLoginMap.get(user.id)?.count || 0,
      }))
        .sort((a, b) => b.login_count - a.login_count) || [];

      // Calculate unique viewers for engagement rate when filtering by community
      let uniqueViewersCount = 0;
      if (communityFilter) {
        const { data: communityViewUsers } = await supabase
          .from('content_views')
          .select('user_id')
          .eq('community_id', communityFilter);
        uniqueViewersCount = new Set(communityViewUsers?.map(v => v.user_id) || []).size;
      }

      // For filtered community, use same member_count logic as Community Performance table
      // Prefer registered users, fallback to unique viewers
      const memberCount = communityFilter
        ? (totalUsers > 0 ? totalUsers : uniqueViewersCount)
        : totalUsers;

      let communityPerformance: CommunityPerformance[] = [];
      if (!communityFilter) {
        const { data: communities } = await supabase
          .from('communities')
          .select('*');

        if (communities) {
          communityPerformance = await Promise.all(
            communities.map(async (community) => {
              const communityUsers = users?.filter(u => u.community_id === community.id) || [];

              const { count: communityViewsCount } = await supabase
                .from('content_views')
                .select('*', { count: 'exact', head: true })
                .eq('community_id', community.id);

              // Get all unique users who have ever viewed content in this community
              const { data: allCommunityViewUsers } = await supabase
                .from('content_views')
                .select('user_id')
                .eq('community_id', community.id);

              const uniqueCommunityViewers = new Set(allCommunityViewUsers?.map(v => v.user_id) || []).size;

              // Get active users from content views today
              const { data: communityViewsToday } = await supabase
                .from('content_views')
                .select('user_id')
                .eq('community_id', community.id)
                .gte('viewed_at', todayISO);

              const activeToday = new Set(communityViewsToday?.map(v => v.user_id) || []).size;

              // Calculate average session duration from content view durations
              const { data: communityViewsDurations } = await supabase
                .from('content_views')
                .select('view_duration')
                .eq('community_id', community.id)
                .not('view_duration', 'is', null);

              const avgSessionDuration = communityViewsDurations && communityViewsDurations.length > 0
                ? communityViewsDurations.reduce((sum, v) => sum + (v.view_duration || 0), 0) / communityViewsDurations.length
                : 0;

              return {
                community_id: community.id,
                community_name: community.name,
                member_count: communityUsers.length > 0 ? communityUsers.length : uniqueCommunityViewers,
                active_users_today: activeToday,
                total_views: communityViewsCount || 0,
                avg_session_duration: Math.round(avgSessionDuration),
                engagement_rate: communityViewsCount && communityViewsCount > 0
                  ? Math.round((uniqueCommunityViewers / communityViewsCount) * 100)
                  : 0,
              };
            })
          );
        }
      }

      const adjustedAnalytics = {
        totalViews,
        // Display actual member count in Quick Stats (matching Community Performance table)
        totalUsers: memberCount,
        // For engagement calculation: when filtered, scale unique viewers by member count divided by total views
        // This ensures: (activeUsersToday / totalUsers) * 100 = (uniqueViewersCount / totalViews) * 100
        activeUsersToday: communityFilter
          ? (totalViews > 0 ? (uniqueViewersCount * memberCount) / totalViews : 0)
          : activeUsersToday,
        averageSessionDuration: Math.round(avgDuration),
        topContent,
        userActivity,
        recentViews: views || [],
        communityPerformance,
        usersByRole,
        usersByTier,
      };

      setAnalytics(adjustedAnalytics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [communityFilter]);

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics,
  };
};