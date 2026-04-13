import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { applyDiscountFromDatabase } from '../utils/helper';
import { Invoice } from '../types';

export const useOrganizationInvoices = () => {
  const { user, isOrganizationManager } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCommunities, setPendingCommunities] = useState<Array<{ id: string; name: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchInvoices = async () => {
    if (!user || !isOrganizationManager) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get org id and name for the user
      const { data: managerRecord, error: managerError } = await supabase
        .from('organization_managers')
        .select('organization_id, organizations!inner(name)')
        .eq('user_id', user.id)
        .single();

      if (managerError) throw managerError;
      if (!managerRecord) {
        setInvoices([]);
        setPendingCommunities([]);
        return;
      }

      const organizationName = (managerRecord.organizations as any)?.name;
      const organizationId = managerRecord.organization_id;

      // Fetch all communities in the organization
      const { data: communities, error: communitiesError } = await supabase
        .from('communities')
        .select('id, name, activation_date')
        .eq('organization_id', organizationId);

      if (communitiesError) {
        console.error('Error fetching communities:', communitiesError);
      }

      // Fetch invoices directly by organization_id
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (invoiceError) throw invoiceError;

      // Determine which communities have no invoices (pending)
      const invoicedCommunityIds = new Set(
        (invoiceData || []).map((inv: any) => inv.community_id)
      );
      const pending = (communities || []).filter((c) => {
        if (invoicedCommunityIds.has(c.id)) return false;
        if (!c.activation_date) return false;
        const today = new Date().toISOString().split('T')[0];
        const actDate = new Date(c.activation_date).toISOString().split('T')[0];
        return actDate <= today;
      });
      setPendingCommunities(pending);

      const enrichedInvoices: Invoice[] = invoiceData?.map(inv => {
        return {
          id: inv.id,
          invoice_no: Number(inv.invoice_no),
          issueDate: inv.issue_date,
          periodStart: inv.period_start,
          periodEnd: inv.period_end,
          amountCents: Number(inv.amount_cents),
          currency: inv.currency,
          status: inv.status,
          discountPercentage: inv.discount_percentage ?? 0,
          communityId: inv.community_id,
          communityName: inv.community_name ?? null,
          communityTier: (inv.community_tier as any) ?? undefined,
          communityCode: inv.community_code ?? null,
          createdAt: inv.created_at,
          organizationId: inv.organization_id,
          organizationName: organizationName,
          communityManagerEmail: inv.community_manager_email ?? null,
          communityManagerName: inv.community_manager_name ?? null,
        };
      }) || [];

      // Apply discount logic
      const discounted = applyDiscountFromDatabase(enrichedInvoices);
      setInvoices(discounted as Invoice[]);

    } catch (err) {
      console.error('Error fetching org invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const generateNow = async () => {
    if (pendingCommunities.length === 0) return;

    setIsGenerating(true);
    try {
      const { error } = await supabase.functions.invoke('create-first-invoice', {
        body: {
          force: true,
          communityIds: pendingCommunities.map((c) => c.id),
        },
      });

      if (error) throw error;

      // Reload invoices after generation
      await fetchInvoices();
    } catch (error) {
      console.error('Error generating invoices:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [user, isOrganizationManager]);

  return {
    invoices,
    loading,
    error,
    pendingCommunities,
    isGenerating,
    generateNow,
    refetch: fetchInvoices
  };
};

