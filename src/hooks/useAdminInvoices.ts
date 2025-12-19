import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCommunities } from './useCommunities'
import { applyDiscountFromDatabase } from '../utils/helper'
import { InvoiceStatus, buildInvoiceStatus, Invoice, PaymentTier } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const client = createClient(supabaseUrl, supabaseAnonKey)

export function useAdminInvoices() {
  const { isAdmin, isCommunityManager, loading: authLoading } = useAuth()
  const { communities, loading: communitiesLoading } = useCommunities()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingCommunities, setPendingCommunities] = useState<Array<{ id: string; name: string }>>([])
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (authLoading || communitiesLoading) {
      setIsLoading(true)
      return
    }

    if (!isAdmin && !isCommunityManager) {
      setIsLoading(false)
      return
    }

    async function loadInvoices() {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch all active communities to check for pending invoices
        const { data: allCommunities, error: communitiesError } = await client
          .from('communities')
          .select('id, name')
          .eq('is_active', true)

        if (communitiesError) {
          console.error('Error fetching communities:', communitiesError)
        }

        let query = client
          .from('invoices')
          .select('*, organization:organization_id(name)')
          .order('period_start', { ascending: false })

        // Filter by community if selected
        if (selectedCommunityId) {
          query = query.eq('community_id', selectedCommunityId)
        }

        const { data, error: fetchError } = await query

        if (fetchError) {
          console.error('Error fetching invoices:', fetchError)
          setError(fetchError.message)
          setIsLoading(false)
          return
        }

        // Determine pending communities (communities without invoices)
        const invoicedCommunityIds = new Set(
          (data || []).map((inv: any) => inv.community_id)
        )
        const pending = (allCommunities || []).filter(
          (c) => !invoicedCommunityIds.has(c.id)
        )
        setPendingCommunities(pending)

        const normalizedInvoices: Invoice[] = (data || []).map((inv: any) => ({
          invoice_no: Number(inv.invoice_no),
          issueDate: inv.issue_date,
          periodStart: inv.period_start,
          periodEnd: inv.period_end,
          amountCents: Number(inv.amount_cents),
          currency: inv.currency,
          status: inv.status,
          discountPercentage: inv.discount_percentage ?? 0,
          communityId: inv.community_id,
          communityName: inv.community_name || null,
          communityCode: inv.community_code || null,
          communityTier: inv.community_tier as PaymentTier,
          id: inv.id,
          createdAt: inv.created_at,
          communityManagerEmail: inv.community_manager_email ?? null,
          communityManagerName: inv.community_manager_name ?? null,
          organizationId: inv.organization_id ?? null,
          organizationName: inv.organization?.name ?? null,
        }))

        setInvoices(applyDiscountFromDatabase(normalizedInvoices))
      } catch (err) {
        console.error('Error loading invoices:', err)
        setError(err instanceof Error ? err.message : 'Failed to load invoices')
      } finally {
        setIsLoading(false)
      }
    }

    loadInvoices()
  }, [authLoading, communitiesLoading, isAdmin, isCommunityManager, selectedCommunityId])

  const updateInvoiceStatus = async (invoiceId: string, statusType: InvoiceStatus, customText?: string) => {
    if (!isAdmin) {
      throw new Error('Only admins can update invoice status')
    }

    const statusValue = buildInvoiceStatus(statusType, customText)

    const { error: updateError } = await client
      .from('invoices')
      .update({ status: statusValue })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Error updating invoice status:', updateError)
      throw updateError
    }

    // Refresh the invoice list
    setIsLoading(true)
    setError(null)

    try {
      let query = client
        .from('invoices')
        .select('*')
        .order('period_start', { ascending: false })

      if (selectedCommunityId) {
        query = query.eq('community_id', selectedCommunityId)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        setError(fetchError.message)
        setIsLoading(false)
        return
      }

      const normalizedInvoices: Invoice[] = (data || []).map((inv: any) => ({
        invoice_no: Number(inv.invoice_no),
        issueDate: inv.issue_date,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        amountCents: Number(inv.amount_cents),
        currency: inv.currency,
        status: inv.status,
        discountPercentage: inv.discount_percentage ?? 0,
        communityId: inv.community_id,
        communityName: inv.community_name || null,
        communityCode: inv.community_code || null,
        communityTier: inv.community_tier as PaymentTier,
        id: inv.id,
        createdAt: inv.created_at,
        communityManagerEmail: inv.community_manager_email ?? null,
        communityManagerName: inv.community_manager_name ?? null,
        organizationId: inv.organization_id ?? null,
        organizationName: inv.organization?.name ?? null,
      }))

      setInvoices(applyDiscountFromDatabase(normalizedInvoices))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh invoices')
    } finally {
      setIsLoading(false)
    }
  }

  const deleteInvoice = async (invoiceId: string) => {
    if (!isAdmin) {
      throw new Error('Only admins can delete invoices')
    }

    const { data: deletedData, error: deleteError } = await client
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .select()

    if (deleteError) {
      console.error('Error deleting invoice:', deleteError)
      throw deleteError
    }

    if (!deletedData || deletedData.length === 0) {
      console.warn('Delete operation returned no data. Possible RLS restriction or ID mismatch.')
      throw new Error('Deletion failed: API reported success but no record was removed.')
    }

    // Refresh the invoice list locally
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId))
  }

  const generateNow = async () => {
    if (pendingCommunities.length === 0) return

    setIsGenerating(true)
    try {
      const { error } = await client.functions.invoke('create-first-invoice', {
        body: {
          force: true,
          communityIds: pendingCommunities.map((c) => c.id),
        },
      })

      if (error) throw error

      // Reload invoices after generation
      setIsLoading(true)
      setError(null)

      try {
        // Fetch all active communities to check for pending invoices
        const { data: allCommunities, error: communitiesError } = await client
          .from('communities')
          .select('id, name')
          .eq('is_active', true)

        if (communitiesError) {
          console.error('Error fetching communities:', communitiesError)
        }

        let query = client
          .from('invoices')
          .select('*, organization:organization_id(name)')
          .order('period_start', { ascending: false })

        if (selectedCommunityId) {
          query = query.eq('community_id', selectedCommunityId)
        }

        const { data, error: fetchError } = await query

        if (fetchError) {
          setError(fetchError.message)
          setIsLoading(false)
          return
        }

        // Determine pending communities
        const invoicedCommunityIds = new Set(
          (data || []).map((inv: any) => inv.community_id)
        )
        const pending = (allCommunities || []).filter(
          (c) => !invoicedCommunityIds.has(c.id)
        )
        setPendingCommunities(pending)

        const normalizedInvoices: Invoice[] = (data || []).map((inv: any) => ({
          invoice_no: Number(inv.invoice_no),
          issueDate: inv.issue_date,
          periodStart: inv.period_start,
          periodEnd: inv.period_end,
          amountCents: Number(inv.amount_cents),
          currency: inv.currency,
          status: inv.status,
          discountPercentage: inv.discount_percentage ?? 0,
          communityId: inv.community_id,
          communityName: inv.community_name || null,
          communityCode: inv.community_code || null,
          communityTier: inv.community_tier as PaymentTier,
          id: inv.id,
          createdAt: inv.created_at,
          communityManagerEmail: inv.community_manager_email ?? null,
          communityManagerName: inv.community_manager_name ?? null,
          organizationId: inv.organization_id ?? null,
          organizationName: inv.organization?.name ?? null,
        }))

        setInvoices(applyDiscountFromDatabase(normalizedInvoices))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh invoices')
      } finally {
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error generating invoices:', error)
      throw error
    } finally {
      setIsGenerating(false)
    }
  }

  return useMemo(
    () => ({
      invoices,
      communities,
      selectedCommunityId,
      setSelectedCommunityId,
      isLoading,
      error,
      pendingCommunities,
      isGenerating,
      generateNow,
      updateInvoiceStatus,
      deleteInvoice,
      refresh: async () => {
        if (!isAdmin && !isCommunityManager) return
        setIsLoading(true)
        setError(null)

        try {
          let query = client
            .from('invoices')
            .select(`*, community:community_id(name, membership_tier, code, organization:organization_id(name))`)
            .order('period_start', { ascending: false })

          if (selectedCommunityId) {
            query = query.eq('community_id', selectedCommunityId)
          }

          const { data, error: fetchError } = await query

          if (fetchError) {
            setError(fetchError.message)
            setIsLoading(false)
            return
          }

          const normalizedInvoices: Invoice[] = (data || []).map((inv: any) => ({
            invoice_no: Number(inv.invoice_no),
            issueDate: inv.issue_date,
            periodStart: inv.period_start,
            periodEnd: inv.period_end,
            amountCents: Number(inv.amount_cents),
            currency: inv.currency,
            status: inv.status,
            discountPercentage: inv.discount_percentage ?? 0,
            communityId: inv.community_id,
            communityName: inv.community?.name || null,
            communityCode: inv.community?.code || null,
            communityTier: inv.community?.membership_tier as PaymentTier,
            id: inv.id,
            createdAt: inv.created_at,
            communityManagerEmail: inv.community_manager_email ?? null,
            communityManagerName: inv.community_manager_name ?? null,
            organizationId: inv.organization_id ?? inv.community?.organization?.id ?? null,
            organizationName: inv.community?.organization?.name ?? null, // Note: This depends on the specific query used in refresh
          })).sort(
            (a, b) => {
              const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
              const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
              return bTime - aTime
            }
          )

          setInvoices(applyDiscountFromDatabase(normalizedInvoices))
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to refresh invoices')
        } finally {
          setIsLoading(false)
        }
      },
    }),
    [invoices, communities, selectedCommunityId, isLoading, error, pendingCommunities, isGenerating, generateNow, isAdmin]
  )
}

