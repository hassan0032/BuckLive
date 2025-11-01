import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ContentView } from '../types';

interface AnalyticsData {
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
    last_login: string;
    login_count: number;
  }>;
  recentViews: Array<ContentView & { user_name?: string; user_email?: string }>;
}

interface AnonymousAnalyticsData {
  totalViews: number;
  engagementRate: number;
  topContent: Array<{
    content_id: string;
    title: string;
    view_count: number;
    total_duration: number;
  }>;
  recentViews: Array<ContentView & { user_name?: string; user_email?: string }>;
}

export const useCommunityAnalytics = (communityId?: string) => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalViews: 0,
    totalUsers: 0,
    activeUsersToday: 0,
    averageSessionDuration: 0,
    topContent: [],
    userActivity: [],
    recentViews: [],
  });
  const [anonymousAnalytics, setAnonymousAnalytics] = useState<AnonymousAnalyticsData>({
    totalViews: 0,
    engagementRate: 0,
    topContent: [],
    recentViews: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!communityId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name')
        .eq('community_id', communityId);

      const userIds = users?.map(u => u.id) || [];
      const totalUsers = users?.length || 0;

      if (userIds.length === 0) {
        setAnalytics({
          totalViews: 0,
          totalUsers: 0,
          activeUsersToday: 0,
          averageSessionDuration: 0,
          topContent: [],
          userActivity: [],
          recentViews: [],
        });
        setLoading(false);
        return;
      }

      // Fetch authenticated user views
      const { data: views, error: viewsError } = await supabase
        .from('content_views')
        .select('*')
        .eq('community_id', communityId)
        .not('user_id', 'is', null)
        .order('viewed_at', { ascending: false })
        .limit(100);

      if (viewsError) throw viewsError;

      const totalViews = views?.length || 0;

      // Fetch anonymous user views (where user_id is null)
      const { data: anonymousViews, error: anonymousViewsError } = await supabase
        .from('content_views')
        .select('*')
        .eq('community_id', communityId)
        .is('user_id', null)
        .order('viewed_at', { ascending: false })
        .limit(100);

      if (anonymousViewsError) throw anonymousViewsError;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todaySessions } = await supabase
        .from('user_sessions')
        .select('user_id')
        .in('user_id', userIds)
        .gte('login_at', today.toISOString());

      const activeUsersToday = new Set(todaySessions?.map(s => s.user_id) || []).size;

      const { data: allSessions } = await supabase
        .from('user_sessions')
        .select('session_duration')
        .in('user_id', userIds)
        .not('session_duration', 'is', null);

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

      const { data: userSessions } = await supabase
        .from('user_sessions')
        .select('user_id, login_at')
        .in('user_id', userIds)
        .order('login_at', { ascending: false });

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
        last_login: userLoginMap.get(user.id)?.lastLogin || 'Never',
        login_count: userLoginMap.get(user.id)?.count || 0,
      })) || [];

      const recentViewsWithNames = (views || []).map(view => {
        const user = users?.find(u => u.id === view.user_id);
        const user_name = user 
          ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
          : 'Unknown User';
        const user_email = user?.email || 'Unknown Email';
        return { ...view, user_name, user_email };
      });

      // Process anonymous analytics
      const anonymousTotalViews = anonymousViews?.length || 0;

      // Calculate engagement rate (views today / total views)
      // Reuse the 'today' variable already defined above
      const anonymousViewsToday = anonymousViews?.filter(view => 
        new Date(view.viewed_at) >= today
      ).length || 0;

      const anonymousEngagementRate = anonymousTotalViews > 0
        ? Math.round((anonymousViewsToday / anonymousTotalViews) * 100)
        : 0;

      const anonymousContentViewMap = new Map<string, { count: number; duration: number }>();
      anonymousViews?.forEach(view => {
        const existing = anonymousContentViewMap.get(view.content_id) || { count: 0, duration: 0 };
        anonymousContentViewMap.set(view.content_id, {
          count: existing.count + 1,
          duration: existing.duration + (view.view_duration || 0),
        });
      });

      const anonymousContentIds = Array.from(anonymousContentViewMap.keys());
      const { data: anonymousContentData } = await supabase
        .from('content')
        .select('id, title')
        .in('id', anonymousContentIds);

      const anonymousTopContent = Array.from(anonymousContentViewMap.entries())
        .map(([content_id, stats]) => ({
          content_id,
          title: anonymousContentData?.find(c => c.id === content_id)?.title || 'Unknown',
          view_count: stats.count,
          total_duration: stats.duration,
        }))
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 10);

      const anonymousRecentViews = (anonymousViews || []).map(view => ({
        ...view,
        user_name: 'Anonymous User',
        user_email: 'N/A',
      }));

      setAnalytics({
        totalViews,
        totalUsers,
        activeUsersToday,
        averageSessionDuration: Math.round(avgDuration),
        topContent,
        userActivity,
        recentViews: recentViewsWithNames,
      });

      setAnonymousAnalytics({
        totalViews: anonymousTotalViews,
        engagementRate: anonymousEngagementRate,
        topContent: anonymousTopContent,
        recentViews: anonymousRecentViews,
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
  }, [communityId]);

  return {
    analytics,
    anonymousAnalytics,
    loading,
    error,
    refetch: fetchAnalytics,
  };
};
