import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Organization } from '../types';

export interface AdminOrganization extends Organization {
  member_count?: number;
  community_count?: number;
  managers?: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
  }[];
}

export const useAdminOrganizations = () => {
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (orgsError) throw orgsError;

      // For each org, fetch counts and managers
      const enrichedOrgs = await Promise.all(orgs.map(async (org) => {
        // Get community count
        const { count: communityCount, error: countError } = await supabase
          .from('communities')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id);

        if (countError) console.error('Error fetching community count:', countError);

        // Get managers
        const { data: managers, error: managersError } = await supabase
          .from('organization_managers')
          .select(`
            user_id,
            user_profiles:user_id (
              email,
              first_name,
              last_name
            )
          `)
          .eq('organization_id', org.id);

        if (managersError) console.error('Error fetching managers:', managersError);

        const formattedManagers = managers?.map((m: any) => ({
          user_id: m.user_id,
          email: m.user_profiles?.email || '',
          first_name: m.user_profiles?.first_name || '',
          last_name: m.user_profiles?.last_name || '',
        })) || [];

        return {
          ...org,
          community_count: communityCount || 0,
          managers: formattedManagers,
        };
      }));

      setOrganizations(enrichedOrgs);
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  }, []);

  const addOrganization = async (orgData: { name: string; description?: string }) => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert([orgData])
        .select()
        .single();

      if (error) throw error;
      await fetchOrganizations();
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to add organization' };
    }
  };

  const updateOrganization = async (id: string, updates: Partial<Organization>) => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchOrganizations();
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to update organization' };
    }
  };

  const deleteOrganization = async (id: string) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setOrganizations(prev => prev.filter(org => org.id !== id));
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete organization' };
    }
  };

  const assignManager = async (organizationId: string, email: string) => {
    try {
      // First find the user by email
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (userError || !userProfile) throw new Error('User not found');

      // Create the assignment
      const { error: assignError } = await supabase
        .from('organization_managers')
        .insert({
          organization_id: organizationId,
          user_id: userProfile.id
        });

      if (assignError) {
        if (assignError.code === '23505') throw new Error('User is already a manager for this organization');
        throw assignError;
      }

      await fetchOrganizations();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to assign manager' };
    }
  };

  const removeManager = async (organizationId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('organization_managers')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', userId);

      if (error) throw error;
      await fetchOrganizations();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to remove manager' };
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  return {
    organizations,
    loading,
    error,
    addOrganization,
    updateOrganization,
    deleteOrganization,
    refetch: fetchOrganizations
  };
};
