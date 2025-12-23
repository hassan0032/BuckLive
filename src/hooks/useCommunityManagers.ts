import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface CommunityManager {
  id: string;
  user_id: string;
  community_id: string;
  created_at: string;
  user_profiles?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export const useCommunityManagers = (communityId?: string) => {
  const [managers, setManagers] = useState<CommunityManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManagers = async () => {
    if (!communityId) {
      setLoading(false);
      setManagers([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('community_managers')
        .select(`
          *,
          user_profiles!community_managers_user_id_fkey(
            id,
            email,
            first_name,
            last_name
          )
        `)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setManagers(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch managers');
      setManagers([]);
    } finally {
      setLoading(false);
    }
  };

  const addManager = async (userId: string) => {
    if (!communityId) {
      return { error: 'No community selected' };
    }

    try {
      const { error: insertError } = await supabase
        .from('community_managers')
        .insert([{
          user_id: userId,
          community_id: communityId,
        }]);

      if (insertError) throw insertError;

      await fetchManagers();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to add manager' };
    }
  };

  const removeManager = async (managerId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('community_managers')
        .delete()
        .eq('id', managerId);

      if (deleteError) throw deleteError;

      await fetchManagers();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to remove manager' };
    }
  };

  useEffect(() => {
    fetchManagers();
  }, [communityId]);

  return {
    managers,
    loading,
    error,
    addManager,
    removeManager,
    refetch: fetchManagers,
  };
};
