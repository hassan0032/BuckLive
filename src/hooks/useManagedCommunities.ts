import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Community } from '../types';

export const useManagedCommunities = (userId?: string) => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false)

  const fetchManagedCommunities = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: managerData, error: managerError } = await supabase
        .from('community_managers')
        .select('community_id')
        .eq('user_id', userId);

      if (managerError) throw managerError;

      const communityIds = managerData?.map(m => m.community_id) || [];

      if (communityIds.length === 0) {
        setCommunities([]);
        setLoading(false);
        return;
      }

      const { data: communitiesData, error: communitiesError } = await supabase
        .from('communities')
        .select('*')
        .in('id', communityIds)
        .order('created_at', { ascending: false });

      if (communitiesError) throw communitiesError;

      const communitiesWithCounts = await Promise.all(
        (communitiesData || []).map(async (community) => {
          const { count } = await supabase
            .from('user_profiles')
            .select('id', { count: 'exact', head: true })
            .eq('community_id', community.id);

          return {
            ...community,
            member_count: count || 0,
          };
        })
      );

      setCommunities(communitiesWithCounts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch communities')
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  };

  const updateCommunity = (communityId: string, updates: Partial<Community>) => {
    setCommunities(prev =>
      prev.map(community =>
        community.id === communityId ? { ...community, ...updates } : community
      )
    );
  };

  const deleteCommunity = async (communityId: string) => {
    if (!communityId) return

    try {
      setDeleting(true)
      await supabase.from('community_managers').delete().eq('community_id', communityId)
      await supabase.from('user_profiles').update({ community_id: null }).eq('community_id', communityId)

      const { error: deleteError } = await supabase
        .from('communities')
        .delete()
        .eq('id', communityId)

      if (deleteError) throw deleteError

      setCommunities((prev) => prev.filter((c) => c.id !== communityId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete community')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    fetchManagedCommunities();
  }, [userId]);

  return {
    communities,
    loading,
    error,
    refetch: fetchManagedCommunities,
    deleting,
    deleteCommunity,
    updateCommunity,
  };
};
