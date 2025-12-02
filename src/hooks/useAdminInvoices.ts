import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCommunities } from './useCommunities'
import { withDiscountedAmounts } from '../utils/helper'
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
  communityId: string | null
  communityName: string | null
  communityCode: string | null
  communityTier: 'gold' | 'silver' | undefined
  id: string // Invoice ID for updates
  calculatedAmountCents?: number
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
          .select(`*, community:community_id(name, membership_tier, code)`)
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
          communityId: inv.community_id,
          communityName: inv.community?.name || null,
          communityCode: inv.community?.code || null,
          communityTier: inv.community?.membership_tier as 'gold' | 'silver' | undefined,
          id: inv.id,
          createdAt: inv.created_at,
        }))

        setInvoices(withDiscountedAmounts(normalizedInvoices))
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
        communityId: inv.community_id,
        communityName: inv.community?.name || null,
        communityCode: inv.community?.code || null,
        communityTier: inv.community?.membership_tier as 'gold' | 'silver' | undefined,
        id: inv.id,
      }))

      setInvoices(withDiscountedAmounts(normalizedInvoices))
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
            communityId: inv.community_id,
            communityName: inv.community?.name || null,
            communityCode: inv.community?.code || null,
            communityTier: inv.community?.membership_tier as 'gold' | 'silver' | undefined,
            id: inv.id,
            createdAt: inv.created_at,
          })).sort(
            (a, b) => {
              const aDate = new Date(a.createdAt).getTime()
              const bDate = new Date(b.createdAt).getTime()
              if (aDate === bDate) {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              }
              return bDate - aDate
            }
          )

          setInvoices(withDiscountedAmounts(normalizedInvoices))
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

