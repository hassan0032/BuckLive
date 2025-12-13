import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { applyDiscountFromDatabase } from '../utils/helper';

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
      .select('*')
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
      discountPercentage: inv.discount_percentage ?? 0,

      communityId: inv.community_id,
      communityName: inv.community_name ?? null,
      communityTier: inv.community_tier ?? null,
      communityCode: inv.community_code ?? null,

      createdAt: inv.created_at,
      userId: user.id,

      communityManagerEmail: inv.community_manager_email ?? null,
      communityManagerName: inv.community_manager_name ?? null,
    }));

    // Sort descending by issue date for display
    normalized.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply discount logic using stored discount_percentage from database
    const discounted = applyDiscountFromDatabase(normalized);

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
    }),
    [enabled, startDate, renewalDate, invoices, isLoading, authLoading, loadInvoices]
  );
}

