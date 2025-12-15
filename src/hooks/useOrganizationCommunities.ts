import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Community } from '../types';

export const useOrganizationCommunities = () => {
  const { user, isOrganizationManager } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunities = async () => {
    if (!user || !isOrganizationManager) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // First get the organization ID for this user
      const { data: managerRecord, error: managerError } = await supabase
        .from('organization_managers')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (managerError) throw managerError;
      if (!managerRecord) {
        setCommunities([]);
        return;
      }

      // Fetch communities for this organization
      const { data: communitiesData, error: communitiesError } = await supabase
        .from('communities')
        .select('*')
        .eq('organization_id', managerRecord.organization_id)
        .order('created_at', { ascending: false });

      if (communitiesError) throw communitiesError;

      // Add member counts
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
    } catch (err) {
      console.error('Error fetching organization communities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch communities');
    } finally {
      setLoading(false);
    }
  };

  const addCommunity = async (communityData: Omit<Community, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Get org id first
      const { data: managerRecord } = await supabase
        .from('organization_managers')
        .select('organization_id')
        .eq('user_id', user?.id)
        .single();

      if (!managerRecord) throw new Error('No organization found');

      const { data, error } = await supabase
        .from('communities')
        .insert([{
          ...communityData,
          organization_id: managerRecord.organization_id
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchCommunities();
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to add community' };
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [user, isOrganizationManager]);

  return {
    communities,
    loading,
    error,
    addCommunity,
    refetch: fetchCommunities
  };
};
