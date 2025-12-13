import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCommunities } from './useCommunities'
import { applyDiscountFromDatabase } from '../utils/helper'
import { InvoiceStatus, buildInvoiceStatus } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const client = createClient(supabaseUrl, supabaseAnonKey)

interface InvoiceData {
  invoice_no: number
  issueDate: string
  periodStart: string
  periodEnd: string
  amountCents: number
  currency: string
  status: string
  discountPercentage?: number
  communityId: string | null
  communityName: string | null
  communityCode: string | null
  communityTier: 'gold' | 'silver' | undefined
  id: string // Invoice ID for updates
  calculatedAmountCents?: number
  communityManagerEmail?: string | null
  communityManagerName?: string | null
  createdAt?: string
}

export function useAdminInvoices() {
  const { isAdmin, loading: authLoading } = useAuth()
  const { communities, loading: communitiesLoading } = useCommunities()
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || communitiesLoading) {
      setIsLoading(true)
      return
    }

    if (!isAdmin) {
      setIsLoading(false)
      return
    }

    async function loadInvoices() {
      setIsLoading(true)
      setError(null)

      try {
        let query = client
          .from('invoices')
          .select('*')
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

        const normalizedInvoices: InvoiceData[] = (data || []).map((inv: any) => ({
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
          communityTier: inv.community_tier as 'gold' | 'silver' | undefined,
          id: inv.id,
          createdAt: inv.created_at,
          communityManagerEmail: inv.community_manager_email ?? null,
          communityManagerName: inv.community_manager_name ?? null,
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
  }, [authLoading, communitiesLoading, isAdmin, selectedCommunityId])

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

      const normalizedInvoices: InvoiceData[] = (data || []).map((inv: any) => ({
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
        communityTier: inv.community_tier as 'gold' | 'silver' | undefined,
        id: inv.id,
        createdAt: inv.created_at,
        communityManagerEmail: inv.community_manager_email ?? null,
        communityManagerName: inv.community_manager_name ?? null,
      }))

      setInvoices(applyDiscountFromDatabase(normalizedInvoices))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh invoices')
    } finally {
      setIsLoading(false)
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
      updateInvoiceStatus,
      refresh: async () => {
        if (!isAdmin) return
        setIsLoading(true)
        setError(null)

        try {
          let query = client
            .from('invoices')
            .select(`*, community:community_id(name, membership_tier, code)`)
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

          const normalizedInvoices: InvoiceData[] = (data || []).map((inv: any) => ({
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
            communityTier: inv.community?.membership_tier as 'gold' | 'silver' | undefined,
            id: inv.id,
            createdAt: inv.created_at,
            communityManagerEmail: inv.community_manager_email ?? null,
            communityManagerName: inv.community_manager_name ?? null,
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
    [invoices, communities, selectedCommunityId, isLoading, error, isAdmin]
  )
}

