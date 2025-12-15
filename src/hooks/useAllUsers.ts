import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ROLE, Role, User } from '../types';

interface UseAllUsersFilters {
  organizationId?: string;
  communityId?: string;
  role?: Role;
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
          community:communities!user_profiles_community_id_fkey(*),
          organization:organization_managers!organization_managers_user_id_fkey(*)
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

      // Fetch managed communities for these users
      const communityManagerIds = data?.filter(u => u.role === ROLE.COMMUNITY_MANAGER).map(u => u.id) || [];
      const { data: managersData } = await supabase
        .from('community_managers')
        .select('user_id, community_id')
        .in('user_id', communityManagerIds);

      const managersMap = new Map<string, string[]>();
      if (managersData) {
        managersData.forEach((item: any) => {
          if (!managersMap.has(item.user_id)) {
            managersMap.set(item.user_id, []);
          }
          managersMap.get(item.user_id)?.push(item.community_id);
        });
      }

      const formattedUsers: User[] = (data || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        role: profile.role as Role,
        created_at: profile.created_at,
        community_id: profile.community_id,
        registration_type: profile.registration_type,
        stripe_customer_id: profile.stripe_customer_id,
        subscription_id: profile.subscription_id,
        subscription_status: profile.subscription_status,
        payment_tier: profile.payment_tier,
        subscription_started_at: profile.subscription_started_at,
        subscription_ends_at: profile.subscription_ends_at,
        is_shared_account: profile.is_shared_account || false,
        managed_community_ids: managersMap.get(profile.id) || [],
        profile: {
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          avatar_url: profile.avatar_url || '',
          community: profile.community || undefined,
          organization: profile.organization?.[0] || undefined,
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
    community_id?: string | null;
    role?: Role;
    is_shared_account?: boolean;
    managed_community_ids?: string[];
  }) => {
    try {
      // Get the current session to pass auth header
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return { data: null, error: 'Not authenticated' };
      }

      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create',
          email: userData.email,
          password: userData.password,
          first_name: userData.first_name,
          last_name: userData.last_name,
          community_id: userData.community_id || null,
          role: userData.role,
          is_shared_account: userData.is_shared_account || false,
          managed_community_ids: userData.managed_community_ids || [],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { data: null, error: result.error || 'Failed to create user' };
      }

      if (result.error) {
        return { data: null, error: result.error };
      }

      await fetchUsers();
      return result;
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to create user' };
    }
  };

  const updateUser = async (userId: string, updates: {
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: Role;
    community_id?: string | null;
    is_shared_account?: boolean;
    managed_community_ids?: string[];
  }) => {
    try {
      const currentUser = users.find(u => u.id === userId);
      if (!currentUser) {
        throw new Error('User not found');
      }

      const profileUpdates: Record<string, unknown> = {};
      const effectiveRole = updates.role !== undefined ? updates.role : currentUser.role;

      if (updates.first_name !== undefined) {
        profileUpdates.first_name = updates.first_name;
      }
      if (updates.last_name !== undefined) {
        profileUpdates.last_name = updates.last_name;
      }
      if (updates.email !== undefined) {
        profileUpdates.email = updates.email;
      }
      profileUpdates.role = effectiveRole;

      // Handle community_id constraint: Only Members can have a community_id in profile
      if (effectiveRole === ROLE.MEMBER) {
        if (updates.community_id !== undefined) {
          profileUpdates.community_id = updates.community_id;
        }
      } else {
        // For non-members, community_id must be null
        // We set it to null if it's currently set, or if we are updating role to non-member
        if (currentUser.community_id || updates.community_id) {
          profileUpdates.community_id = null;
        }
      }

      if (updates.is_shared_account !== undefined) {
        profileUpdates.is_shared_account = updates.is_shared_account;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (updateError) throw updateError;

      // Handle managed communities

      // 1. If transitioning AWAY from Community Manager, delete all manager records
      if (currentUser.role === ROLE.COMMUNITY_MANAGER && effectiveRole !== ROLE.COMMUNITY_MANAGER) {
        const { error: deleteManagerError } = await supabase
          .from('community_managers')
          .delete()
          .eq('user_id', userId);

        if (deleteManagerError) throw deleteManagerError;
      }

      // 2. If valid Community Manager (staying or becoming), handle assignments
      if (effectiveRole === ROLE.COMMUNITY_MANAGER) {
        if (updates.managed_community_ids !== undefined) {
          // Replace all managed communities with new list

          // First delete all existing (simplest way to sync)
          const { error: deleteError } = await supabase
            .from('community_managers')
            .delete()
            .eq('user_id', userId);

          if (deleteError) throw deleteError;

          // Then insert new ones
          if (updates.managed_community_ids.length > 0) {
            const { error: insertError } = await supabase
              .from('community_managers')
              .insert(updates.managed_community_ids.map(cid => ({
                user_id: userId,
                community_id: cid
              })));

            if (insertError) throw insertError;
          }
        } else if (currentUser.role !== ROLE.COMMUNITY_MANAGER) {
          // Legacy/Fallback: Becoming CM but no managed_ids passed? 
          // Try to use the single community_id if available (backward compatibility)
          const fallbackCommunityId = updates.community_id || currentUser.community_id;
          if (fallbackCommunityId) {
            const { error: managerError } = await supabase
              .from('community_managers')
              .upsert([
                {
                  user_id: userId,
                  community_id: fallbackCommunityId,
                },
              ], { onConflict: 'user_id,community_id' });

            if (managerError) throw managerError;
          }
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
      // Get the current session to pass auth header
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return { error: 'Not authenticated' };
      }

      // Call the edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-management`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          user_id: userId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { error: result.error || 'Failed to delete user' };
      }

      if (result.error) {
        return { error: result.error };
      }

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
