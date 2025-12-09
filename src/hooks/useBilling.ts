import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ensureCommunityManagerInvoices } from '../lib/supabase';
import { applyDiscountFromDatabase } from '../utils/helper';

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

    // Note: Invoices are already generated on login via AuthContext
    // This is just a fallback in case they weren't generated
    // We don't await it to avoid blocking the UI
    ensureCommunityManagerInvoices(user.id).catch(err => {
      console.error('Error ensuring manager invoices (non-blocking):', err);
    });

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
      .select('*, community:community_id(name, membership_tier, code)')
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
      communityName: inv.community?.name ?? null,
      communityTier: inv.community?.membership_tier ?? null,
      communityCode: inv.community?.code ?? null,

      createdAt: inv.created_at,
      userId: user.id,

      // New proration fields
      isProrated: inv.is_prorated ?? false,
      proratedDays: inv.prorated_days ?? undefined,
      fullYearAmountCents: inv.full_year_amount_cents ?? undefined,
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
      // Get the current session to pass auth header
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Unable to get session for invoice creation');
      }

      // Call the create-first-invoice edge function (handles both automatic and manual creation)
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-first-invoice`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(invoiceData),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to create invoice' }));
        console.error('Failed to create invoice:', response.status, errorBody);
        throw new Error(errorBody.error || 'Failed to create invoice');
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Handle case where invoice already exists
      if (result.created === 0 && result.data) {
        console.log(`ℹ Invoice already exists for community ${invoiceData.community_id}`);
        return result.data;
      }

      const invoice = result.data;
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

