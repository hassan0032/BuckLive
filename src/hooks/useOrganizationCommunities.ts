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

  const assignCommunityManager = async (communityId: string, email: string) => {
    try {
      // Find user by email
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (userError || !userProfile) throw new Error('User not found');

      // Assign to community
      const { error: assignError } = await supabase
        .from('community_managers')
        .insert({
          community_id: communityId,
          user_id: userProfile.id
        });

      if (assignError) {
        if (assignError.code === '23505') throw new Error('User is already a manager for this community');
        throw assignError;
      }

      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to assign manager' };
    }
  };

  const removeCommunityManager = async (communityId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('community_managers')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to remove manager' };
    }
  };

  const getCommunityManagers = async (communityId: string) => {
    try {
      const { data, error } = await supabase
        .from('community_managers')
        .select(`
          user_id,
          user_profiles:user_id (
            email,
            first_name,
            last_name
          )
        `)
        .eq('community_id', communityId);

      if (error) throw error;
      return data?.map((m: any) => ({
        user_id: m.user_id,
        email: m.user_profiles?.email || '',
        first_name: m.user_profiles?.first_name || '',
        last_name: m.user_profiles?.last_name || '',
      })) || [];
    } catch (err) {
      console.error('Error fetching community managers:', err);
      return [];
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
    assignCommunityManager,
    removeCommunityManager,
    getCommunityManagers,
    refetch: fetchCommunities
  };
};
