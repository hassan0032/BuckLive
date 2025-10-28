import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ContentView } from '../types';

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
  user_name?: string;
  content_title?: string;
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
    community_manager: number;
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
    usersByRole: { admin: 0, community_manager: 0, member: 0 },
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
        admin: users?.filter(u => u.role === 'admin').length || 0,
        community_manager: users?.filter(u => u.role === 'community_manager').length || 0,
        member: users?.filter(u => u.role === 'member').length || 0,
      };

      const usersByTier = {
        silver: users?.filter(u => u.payment_tier === 'silver').length || 0,
        gold: users?.filter(u => u.payment_tier === 'gold').length || 0,
        none: users?.filter(u => !u.payment_tier).length || 0,
      };

      if (userIds.length === 0) {
        setAnalytics({
          totalViews: 0,
          totalUsers: 0,
          activeUsersToday: 0,
          averageSessionDuration: 0,
          topContent: [],
          userActivity: [],
          recentViews: [],
          communityPerformance: [],
          usersByRole,
          usersByTier,
        });
        setLoading(false);
        return;
      }

      let viewsQuery = supabase
        .from('content_views')
        .select(`
        *,
        user_profiles!content_views_user_id_fkey (
          id,
          first_name,
          last_name
        ),
        content!content_views_content_id_fkey (
          id,
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

      const totalViews = views?.length || 0;


      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let sessionsQuery = supabase
        .from('user_sessions')
        .select('user_id')
        .in('user_id', userIds)
        .gte('login_at', today.toISOString());

      const { data: todaySessions } = await sessionsQuery;

      const activeUsersToday = new Set(todaySessions?.map(s => s.user_id) || []).size;

      let allSessionsQuery = supabase
        .from('user_sessions')
        .select('session_duration')
        .in('user_id', userIds)
        .not('session_duration', 'is', null);

      const { data: allSessions } = await allSessionsQuery;

      const avgDuration = allSessions && allSessions.length > 0
        ? allSessions.reduce((sum, s) => sum + (s.session_duration || 0), 0) / allSessions.length
        : 0;

      const contentViewMap = new Map<string, { count: number; duration: number }>();
      views?.forEach(view => {
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
        .slice(0, 10);

      let userSessionsQuery = supabase
        .from('user_sessions')
        .select('user_id, login_at')
        .in('user_id', userIds)
        .order('login_at', { ascending: false });

      const { data: userSessions } = await userSessionsQuery;

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

      let communityPerformance: CommunityPerformance[] = [];
      if (!communityFilter) {
        const { data: communities } = await supabase
          .from('communities')
          .select('*');

        if (communities) {
          communityPerformance = await Promise.all(
            communities.map(async (community) => {
              const communityUsers = users?.filter(u => u.community_id === community.id) || [];
              const communityUserIds = communityUsers.map(u => u.id);

              const { data: communityViews } = await supabase
                .from('content_views')
                .select('*')
                .eq('community_id', community.id);

              const { data: communitySessions } = await supabase
                .from('user_sessions')
                .select('user_id, session_duration')
                .in('user_id', communityUserIds)
                .gte('login_at', today.toISOString());

              const activeToday = new Set(communitySessions?.map(s => s.user_id) || []).size;

              const { data: allCommunitySessions } = await supabase
                .from('user_sessions')
                .select('session_duration')
                .in('user_id', communityUserIds)
                .not('session_duration', 'is', null);

              const avgSessionDuration = allCommunitySessions && allCommunitySessions.length > 0
                ? allCommunitySessions.reduce((sum, s) => sum + (s.session_duration || 0), 0) / allCommunitySessions.length
                : 0;

              return {
                community_id: community.id,
                community_name: community.name,
                member_count: communityUsers.length,
                active_users_today: activeToday,
                total_views: communityViews?.length || 0,
                avg_session_duration: Math.round(avgSessionDuration),
                engagement_rate: communityUsers.length > 0
                  ? Math.round((activeToday / communityUsers.length) * 100)
                  : 0,
              };
            })
          );
        }
      }

      setAnalytics({
        totalViews,
        totalUsers,
        activeUsersToday,
        averageSessionDuration: Math.round(avgDuration),
        topContent,
        userActivity,
        recentViews: views || [],
        communityPerformance,
        usersByRole,
        usersByTier,
      });
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