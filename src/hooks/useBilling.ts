import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ensureCommunityManagerInvoices, createInvoicesWithNumbers } from '../lib/supabase';
import { withDiscountedAmounts } from '../utils/helper';

function formatYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function useBilling() {
  const { user, isCommunityManager, loading: authLoading } = useAuth();
  const enabled = !!user && isCommunityManager;

  const [invoices, setInvoices] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadInvoices = useCallback(async () => {
    if (!enabled || !user?.id) {
      setInvoices([]);
      setStartDate(null);
      setRenewalDate(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Ensure invoices exist for this community manager (idempotent)
    try {
      await ensureCommunityManagerInvoices(user.id);
    } catch (err) {
      console.error('Error ensuring manager invoices:', err);
      // Continue loading even if generation fails so the UI still works
    }

    // Fetch communities managed by the user
    const { data: managerCommunities, error: cmError } = await supabase
      .from('community_managers')
      .select('community_id, communities:community_id(name, membership_tier, code)')
      .eq('user_id', user.id);

    if (cmError || !managerCommunities) {
      console.error('Error fetching communities for manager:', cmError);
      setInvoices([]);
      setIsLoading(false);
      return;
    }

    const communityMeta = managerCommunities
      .map((row) => {
        const community = Array.isArray(row.communities)
          ? row.communities[0]
          : row.communities;

        return {
          communityId: row.community_id,
          communityName: community?.name ?? 'Community',
          communityTier: community?.membership_tier ?? null,
          communityCode: community?.code ?? null,
        };
      })
      .filter((c) => !!c.communityId);

    if (communityMeta.length === 0) {
      setInvoices([]);
      setIsLoading(false);
      return;
    }

    const communityIds = communityMeta.map((c) => c.communityId);

    // Fetch existing invoices including community info
    const { data: existingInvoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, communities(name, membership_tier, code)')
      .in('community_id', communityIds);

    if (invoiceError) {
      console.error('Error fetching invoices:', invoiceError);
      setInvoices([]);
      setIsLoading(false);
      return;
    }

    const normalized = (existingInvoices || []).map((inv) => ({
      id: inv.id,
      invoice_no: inv.invoice_no,
      issueDate: inv.issue_date,
      periodStart: inv.period_start,
      periodEnd: inv.period_end,

      amountCents: inv.amount_cents,
      currency: inv.currency,
      status: inv.status,

      communityId: inv.community_id,
      communityName: inv.communities?.name ?? null,
      communityTier: inv.communities?.membership_tier ?? null,
      communityCode: inv.communities?.code ?? null,

      createdAt: inv.created_at,
      // Used by withDiscountedAmounts to group per manager
      userId: user.id,
    }));

    // Sort descending by issue date for display
    normalized.sort(
      (a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
    );

    // Apply discount logic based on number of communities for this manager
    const discounted = withDiscountedAmounts(normalized);

    setInvoices(discounted);
    setStartDate(discounted[discounted.length - 1]?.periodStart ?? null);
    setRenewalDate(discounted[0]?.periodEnd ?? null);
    setIsLoading(false);
  }, [enabled, user?.id]);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    loadInvoices();
  }, [authLoading, loadInvoices]);

  const createInvoice = async (invoiceData: {
    community_id: string;
    issue_date: string;
    period_start: string;
    period_end: string;
    amount_cents: number;
    currency: string;
    status: string;
  }) => {
    setIsLoading(true);
    try {
      // Use shared helper to create invoice with auto-generated number
      const { data: invoices, error } = await createInvoicesWithNumbers([invoiceData]);

      if (error) {
        console.error('Failed to create invoice:', error);
        throw error;
      }

      if (!invoices || invoices.length === 0) {
        throw new Error('Failed to create invoice');
      }

      const invoice = invoices[0];
      console.log(`✅ Created invoice #${invoice.invoice_no} for community ${invoiceData.community_id}`);

      // Refresh invoices list
      await loadInvoices();

      return invoice;
    } catch (err) {
      console.error('Unexpected error creating invoice:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return useMemo(
    () => ({
      enabled,
      startDate,
      renewalDate,
      invoices,
      isLoading,
      refresh: async () => {
        if (!authLoading) await loadInvoices();
      },
      createInvoice,
    }),
    [enabled, startDate, renewalDate, invoices, isLoading, authLoading, loadInvoices]
  );
}

