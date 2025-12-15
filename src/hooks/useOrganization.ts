import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Organization } from '../types';

export const useOrganization = () => {
  const { user, isOrganizationManager } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = async () => {
    if (!user || !isOrganizationManager) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Find the organization this user manages
      const { data: managerRecord, error: managerError } = await supabase
        .from('organization_managers')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (managerError) throw managerError;
      if (!managerRecord) {
        setOrganization(null);
        return;
      }

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', managerRecord.organization_id)
        .single();

      if (orgError) throw orgError;
      setOrganization(org);
    } catch (err) {
      console.error('Error fetching organization:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch organization');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganization();
  }, [user, isOrganizationManager]);

  return {
    organization,
    loading,
    error,
    refetch: fetchOrganization
  };
};
