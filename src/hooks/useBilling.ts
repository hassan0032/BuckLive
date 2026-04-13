import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { applyDiscountFromDatabase } from '../utils/helper';
import { Invoice } from '../types';

export function useBilling() {
  const { user, isCommunityManager, loading: authLoading } = useAuth();
  const enabled = !!user && isCommunityManager;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCommunities, setPendingCommunities] = useState<Array<{ id: string; name: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadInvoices = useCallback(async () => {
    if (!enabled || !user?.id) {
      setInvoices([]);
      setStartDate(null);
      setRenewalDate(null);
      setPendingCommunities([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Fetch communities managed by the user
    const { data: managerCommunities, error: cmError } = await supabase
      .from('community_managers')
      .select('community_id')
      .eq('user_id', user.id);

    if (cmError || !managerCommunities) {
      console.error('Error fetching communities for manager:', cmError);
      setInvoices([]);
      setPendingCommunities([]);
      setIsLoading(false);
      return;
    }

    const communityIds = managerCommunities.map((c) => c.community_id);

    if (communityIds.length === 0) {
      setInvoices([]);
      setPendingCommunities([]);
      setIsLoading(false);
      return;
    }

    // Fetch community details to check for pending invoices
    const { data: communities, error: communitiesError } = await supabase
      .from('communities')
      .select('id, name, activation_date')
      .in('id', communityIds);

    if (communitiesError) {
      console.error('Error fetching communities:', communitiesError);
    }

    // Fetch existing invoices including community info and organization info
    const { data: existingInvoices, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        organization:organization_id (name)
      `)
      .in('community_id', communityIds);

    if (invoiceError) {
      console.error('Error fetching invoices:', invoiceError);
      setInvoices([]);
      setPendingCommunities([]);
      setIsLoading(false);
      return;
    }

    // Determine which communities have no invoices (pending)
    const invoicedCommunityIds = new Set(
      (existingInvoices || []).map((inv: any) => inv.community_id)
    );
    const pending = (communities || []).filter((c) => {
      if (invoicedCommunityIds.has(c.id)) return false;
      if (!c.activation_date) return false;
      const today = new Date().toISOString().split('T')[0];
      const actDate = new Date(c.activation_date).toISOString().split('T')[0];
      return actDate <= today;
    });
    setPendingCommunities(pending);

    // Map to Invoice type
    const normalized: Invoice[] = (existingInvoices || []).map((inv: any) => ({
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
      communityCode: inv.community_code ?? null,
      communityTier: inv.community_tier ?? null,

      organizationId: inv.organization_id ?? null,
      organizationName: inv.organization?.name ?? null,

      createdAt: inv.created_at,
    }));

    // Sort descending by issue date for display
    normalized.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply discount logic
    const discounted = applyDiscountFromDatabase(normalized);

    setInvoices(discounted as Invoice[]);
    setStartDate(discounted[discounted.length - 1]?.periodStart ?? null);
    setRenewalDate(discounted[0]?.periodEnd ?? null);
    setIsLoading(false);
  }, [enabled, user?.id]);

  const generateNow = useCallback(async () => {
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
      await loadInvoices();
    } catch (error) {
      console.error('Error generating invoices:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [pendingCommunities, loadInvoices]);

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
      pendingCommunities,
      isGenerating,
      generateNow,
      refresh: async () => {
        if (!authLoading) await loadInvoices();
      },
    }),
    [enabled, startDate, renewalDate, invoices, isLoading, pendingCommunities, isGenerating, generateNow, authLoading, loadInvoices]
  );
}


