import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { applyDiscountFromDatabase } from '../utils/helper';

export const useOrganizationInvoices = () => {
  const { user, isOrganizationManager } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    if (!user || !isOrganizationManager) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get org id
      const { data: managerRecord, error: managerError } = await supabase
        .from('organization_managers')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (managerError) throw managerError;
      if (!managerRecord) {
        setInvoices([]);
        return;
      }

      // Get communities in org
      const { data: communities, error: communitiesError } = await supabase
        .from('communities')
        .select('id, name, membership_tier, code')
        .eq('organization_id', managerRecord.organization_id);

      if (communitiesError) throw communitiesError;

      const communityIds = communities?.map(c => c.id) || [];
      if (communityIds.length === 0) {
        setInvoices([]);
        return;
      }

      // Fetch invoices
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .in('community_id', communityIds)
        .order('created_at', { ascending: false });

      if (invoiceError) throw invoiceError;

      // Join community info manually since we already have it and to avoid complex joins in one query if strict RLS
      const enrichedInvoices = invoiceData?.map(inv => {
        const community = communities?.find(c => c.id === inv.community_id);
        return {
          id: inv.id,
          invoice_no: inv.invoice_no,
          issueDate: inv.issue_date,
          periodStart: inv.period_start,
          periodEnd: inv.period_end,
          amountCents: inv.amount_cents,
          currency: inv.currency,
          status: inv.status,
          discountPercentage: inv.discount_percentage ?? 0,
          communityId: inv.community_id,
          communityName: community?.name || 'Unknown Community',
          communityTier: community?.membership_tier || 'silver',
          communityCode: community?.code || null,
          createdAt: inv.created_at,
        };
      });

      // Apply discount logic using helper
      const discounted = applyDiscountFromDatabase(enrichedInvoices || []);
      setInvoices(discounted);

    } catch (err) {
      console.error('Error fetching org invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [user, isOrganizationManager]);

  return {
    invoices,
    loading,
    error,
    refetch: fetchInvoices
  };
};
