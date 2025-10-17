import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface UseAllUsersFilters {
  communityId?: string;
  role?: 'member' | 'admin' | 'community_manager';
  searchTerm?: string;
}

export const useAllUsers = (filters: UseAllUsersFilters = {}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('user_profiles')
        .select(`
          *,
          community:communities!user_profiles_community_id_fkey(*)
        `)
        .order('created_at', { ascending: false });

      if (filters.communityId) {
        query = query.eq('community_id', filters.communityId);
      }

      if (filters.role) {
        query = query.eq('role', filters.role);
      }

      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        query = query.or(
          `email.ilike.%${searchLower}%,first_name.ilike.%${searchLower}%,last_name.ilike.%${searchLower}%`
        );
      }

      const { data, error: fetchError } = await query;

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
    role?: 'member' | 'admin' | 'community_manager';
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
              role: userData.role || 'member',
              registration_type: 'access_code',
            },
          ]);

        if (profileError) throw profileError;

        if (userData.role === 'community_manager') {
          const { error: managerError } = await supabase
            .from('community_managers')
            .insert([
              {
                user_id: authData.user.id,
                community_id: userData.community_id,
              },
            ]);

          if (managerError) throw managerError;
        }

        await fetchUsers();
        return { data: authData.user, error: null };
      }

      return { data: null, error: 'Failed to create user' };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to create user' };
    }
  };

  const updateUser = async (userId: string, updates: {
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: 'member' | 'admin' | 'community_manager';
    community_id?: string;
  }) => {
    try {
      const currentUser = users.find(u => u.id === userId);
      if (!currentUser) {
        throw new Error('User not found');
      }

      const profileUpdates: any = {};

      if (updates.first_name !== undefined) {
        profileUpdates.first_name = updates.first_name;
      }
      if (updates.last_name !== undefined) {
        profileUpdates.last_name = updates.last_name;
      }
      if (updates.email !== undefined) {
        profileUpdates.email = updates.email;
      }
      if (updates.role !== undefined) {
        profileUpdates.role = updates.role;
      }
      if (updates.community_id !== undefined) {
        profileUpdates.community_id = updates.community_id;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (updateError) throw updateError;

      if (updates.role) {
        if (updates.role === 'community_manager' && currentUser.role !== 'community_manager') {
          const { error: managerError } = await supabase
            .from('community_managers')
            .upsert([
              {
                user_id: userId,
                community_id: updates.community_id || currentUser.community_id || '',
              },
            ], { onConflict: 'user_id,community_id' });

          if (managerError) throw managerError;
        } else if (updates.role !== 'community_manager' && currentUser.role === 'community_manager') {
          const { error: deleteManagerError } = await supabase
            .from('community_managers')
            .delete()
            .eq('user_id', userId);

          if (deleteManagerError) throw deleteManagerError;
        }
      }

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
  }, [filters.communityId, filters.role, filters.searchTerm]);

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
