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

      // Get org id for the user
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

      // Fetch invoices directly by organization_id
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('organization_id', managerRecord.organization_id)
        .order('created_at', { ascending: false });

      if (invoiceError) throw invoiceError;

      const enrichedInvoices = invoiceData?.map(inv => {
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
          communityName: inv.community_name ?? null,
          communityTier: inv.community_tier ?? null,
          communityCode: inv.community_code ?? null,
          createdAt: inv.created_at,
          organizationId: inv.organization_id // Added field if needed
        };
      });

      // Apply discount logic using helper (if it still relies on frontend calc, but invoices now have discount_percentage)
      // The helper 'applyDiscountFromDatabase' likely just uses the discount_percentage from the object if present.
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
