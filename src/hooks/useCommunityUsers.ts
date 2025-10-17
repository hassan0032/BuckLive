import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export const useCommunityUsers = (communityId?: string) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!communityId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select(`
          *,
          community:communities!user_profiles_community_id_fkey(*)
        `)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedUsers: User[] = (data || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        role: profile.role,
        created_at: profile.created_at,
        community_id: profile.community_id,
        registration_type: profile.registration_type,
        stripe_customer_id: profile.stripe_customer_id,
        subscription_id: profile.subscription_id,
        subscription_status: profile.subscription_status,
        payment_tier: profile.payment_tier,
        subscription_started_at: profile.subscription_started_at,
        subscription_ends_at: profile.subscription_ends_at,
        profile: {
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          avatar_url: profile.avatar_url || '',
          community: profile.community || undefined,
        },
      }));

      setUsers(formattedUsers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    community_id: string;
  }) => {
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert([
            {
              id: authData.user.id,
              email: userData.email,
              first_name: userData.first_name,
              last_name: userData.last_name,
              community_id: userData.community_id,
              role: 'member',
              registration_type: 'access_code',
            },
          ]);

        if (profileError) throw profileError;

        await fetchUsers();
        return { data: authData.user, error: null };
      }

      return { data: null, error: 'Failed to create user' };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to create user' };
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const profileUpdates: any = {};

      if (updates.profile?.first_name !== undefined) {
        profileUpdates.first_name = updates.profile.first_name;
      }
      if (updates.profile?.last_name !== undefined) {
        profileUpdates.last_name = updates.profile.last_name;
      }
      if (updates.profile?.avatar_url !== undefined) {
        profileUpdates.avatar_url = updates.profile.avatar_url;
      }
      if (updates.email !== undefined) {
        profileUpdates.email = updates.email;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (updateError) throw updateError;

      await fetchUsers();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to update user' };
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) throw deleteError;

      await fetchUsers();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete user' };
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [communityId]);

  return {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
  };
};
