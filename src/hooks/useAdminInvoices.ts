import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCommunities } from './useCommunities'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const client = createClient(supabaseUrl, supabaseAnonKey)

interface InvoiceData {
  invoice_no: number
  userId: string
  issueDate: string
  periodStart: string
  periodEnd: string
  amountCents: number
  currency: string
  status: string
  communityId: string | null
  communityName: string | null
  communityTier: 'gold' | 'silver' | undefined
  userName?: string
  userEmail?: string
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
          .select(`
            *,
            community:community_id(name, membership_tier),
            user_profiles:user_id(id, email, first_name, last_name)
          `)
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
          userId: inv.user_id,
          issueDate: inv.issue_date,
          periodStart: inv.period_start,
          periodEnd: inv.period_end,
          amountCents: Number(inv.amount_cents),
          currency: inv.currency,
          status: inv.status,
          communityId: inv.community_id,
          communityName: inv.community?.name || null,
          communityTier: inv.community?.membership_tier as 'gold' | 'silver' | undefined,
          userName: inv.user_profiles
            ? `${inv.user_profiles.first_name || ''} ${inv.user_profiles.last_name || ''}`.trim() || undefined
            : undefined,
          userEmail: inv.user_profiles?.email || undefined,
        }))

        setInvoices(normalizedInvoices)
      } catch (err) {
        console.error('Error loading invoices:', err)
        setError(err instanceof Error ? err.message : 'Failed to load invoices')
      } finally {
        setIsLoading(false)
      }
    }

    loadInvoices()
  }, [authLoading, communitiesLoading, isAdmin, selectedCommunityId])

  return useMemo(
    () => ({
      invoices,
      communities,
      selectedCommunityId,
      setSelectedCommunityId,
      isLoading,
      error,
      refresh: async () => {
        if (!isAdmin) return
        setIsLoading(true)
        setError(null)

        try {
          let query = client
            .from('invoices')
            .select(`
              *,
              community:community_id(name, membership_tier),
              user_profiles:user_id(id, email, first_name, last_name)
            `)
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
            userId: inv.user_id,
            issueDate: inv.issue_date,
            periodStart: inv.period_start,
            periodEnd: inv.period_end,
            amountCents: Number(inv.amount_cents),
            currency: inv.currency,
            status: inv.status,
            communityId: inv.community_id,
            communityName: inv.community?.name || null,
            communityTier: inv.community?.membership_tier as 'gold' | 'silver' | undefined,
            userName: inv.user_profiles
              ? `${inv.user_profiles.first_name || ''} ${inv.user_profiles.last_name || ''}`.trim() || undefined
              : undefined,
            userEmail: inv.user_profiles?.email || undefined,
          }))

          setInvoices(normalizedInvoices)
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

