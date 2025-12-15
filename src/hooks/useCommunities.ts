import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Community } from '../types';

export const useCommunities = () => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunities = async () => {
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('*, organization:organizations(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCommunities(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addCommunity = async (communityData: Omit<Community, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('communities')
        .insert([communityData])
        .select()
        .single();

      if (error) throw error;
      setCommunities(prev => [data, ...prev]);
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to add community' };
    }
  };

  const updateCommunity = async (id: string, updates: Partial<Community>) => {
    try {
      const { data, error } = await supabase
        .from('communities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setCommunities(prev => prev.map(item => item.id === id ? data : item));
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to update community' };
    }
  };

  const deleteCommunity = async (id: string) => {
    try {
      const { error } = await supabase
        .from('communities')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCommunities(prev => prev.filter(item => item.id !== id));
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete community' };
    }
  };

  // Manager Management Functions
  const getCommunityManagers = async (communityId: string) => {
    try {
      const { data, error } = await supabase
        .from('community_managers')
        .select(`
          user_id,
          user:user_profiles!user_id (
            id,
            email,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('community_id', communityId);

      if (error) throw error;
      // Flatten the structure
      return {
        data: data.map((item: any) => item.user),
        error: null
      };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to fetch managers' };
    }
  };

  const addManager = async (communityId: string, userId: string) => {
    try {
      // First ensure user has community_manager role
      const { error: roleError } = await supabase
        .from('user_profiles')
        .update({ role: 'community_manager' })
        .eq('id', userId)
        // Only update if not already admin? Or just enforce community_manager role.
        // Usually we want to keep admin as admin.
        // This logic might be better handled in UI or tailored edge function?
        // Safe check: Don't downgrade admins.
        .neq('role', 'admin');

      if (roleError) console.error("Role update warning (might be admin):", roleError);

      const { error } = await supabase
        .from('community_managers')
        .insert([{ community_id: communityId, user_id: userId }]);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to add manager' };
    }
  };

  const removeManager = async (communityId: string, userId: string) => {
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

  const searchPotentialManagers = async (query: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, avatar_url')
        .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to search users' };
    }
  };

  const generateAccessCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  useEffect(() => {
    fetchCommunities();
  }, []);

  return {
    communities,
    loading,
    error,
    addCommunity,
    updateCommunity,
    deleteCommunity,
    generateAccessCode,
    refetch: fetchCommunities,
    getCommunityManagers,
    addManager,
    removeManager,
    searchPotentialManagers,
  };
};