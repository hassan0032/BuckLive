import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { calculateCommunityPrice, withDiscountedAmounts } from '../utils/helper'

function formatYMD(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addYears(ymd: string, years: number) {
  const date = new Date(ymd)
  date.setFullYear(date.getFullYear() + years)
  return formatYMD(date)
}

export function useBilling() {
  const { user, isCommunityManager, loading: authLoading } = useAuth()
  // Only enable for community managers, not admins (admins use useAdminInvoices)
  const enabled = !!user && isCommunityManager
  const [invoices, setInvoices] = useState<any[]>([])
  const [startDate, setStartDate] = useState<string | null>(null)
  const [renewalDate, setRenewalDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true)
      return
    }
    if (!enabled || !user) {
      setIsLoading(false)
      return
    }

    async function loadInvoices() {
      setIsLoading(true)
      const today = formatYMD(new Date())

      const { data: existingInvoices, error } = await supabase
        .from('invoices')
        .select('*, community:community_id(name, membership_tier)')
        .eq('user_id', user?.id)
        .order('period_start', { ascending: false })

      if (error) {
        console.error('Error fetching invoices:', error)
        setIsLoading(false)
        return
      }

      let invoicesToSet = existingInvoices || []

      if (invoicesToSet.length === 0) {
        const [{ count: totalCommunities, error: communityCountError }, { data: cmRow, error: cmError }] =
          await Promise.all([
            supabase
              .from('community_managers')
              .select('community_id', { count: 'exact', head: true })
              .eq('user_id', user?.id),
            supabase
              .from('community_managers')
              .select('community_id, communities:community_id(name, membership_tier)')
              .eq('user_id', user?.id)
              .maybeSingle(),
          ])

        if (communityCountError) {
          console.error('Error counting communities:', communityCountError)
        }

        if (cmError) {
          console.error('Error fetching community tier:', cmError)
        }
        let tier = cmRow?.communities?.[0]?.membership_tier as 'gold' | 'silver' | undefined
        if (!tier && cmRow?.community_id) {
          const { data: communityRow } = await supabase
            .from('communities')
            .select('name, membership_tier')
            .eq('id', cmRow.community_id)
            .maybeSingle()
          tier = (communityRow?.membership_tier as 'gold' | 'silver' | undefined) ?? undefined
        }
        const existingCommunitiesCount = Math.max((totalCommunities ?? 1) - 1, 0)
        const calculatedPrice = calculateCommunityPrice(existingCommunitiesCount, tier ?? 'silver')
        const amount = calculatedPrice * 100

        const currentStart = today
        const currentEnd = addYears(today, 1)

        const { data: inserted, error: insertError } = await supabase
          .from('invoices')
          .insert([
            {
              user_id: user?.id,
              issue_date: today,
              period_start: currentStart,
              period_end: currentEnd,
              amount_cents: amount,
              currency: 'USD',
              status: 'issued',
              community_id: cmRow?.community_id ?? null,
            },
          ])
          .select('*, community:community_id(name, membership_tier)')

        if (insertError) {
          console.error('Error inserting invoice:', insertError)
          setIsLoading(false)
          return
        }

        invoicesToSet = inserted || []
      }


      // Fetch community info for all invoices
      const normalizedInvoices = invoicesToSet.map((inv) => ({
        id: inv.id,
        invoice_no: Number(inv.invoice_no),
        userId: inv.user_id,
        issueDate: inv.issue_date,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        amountCents: Number(inv.amount_cents),
        currency: inv.currency,
        status: inv.status,
        communityId: inv.community_id,
        communityName: inv.community?.name,
        communityTier: inv.community?.membership_tier as 'gold' | 'silver' | undefined,
      }))

      const invoicesWithCalculatedAmounts = withDiscountedAmounts(normalizedInvoices)

      setInvoices(invoicesWithCalculatedAmounts)
      setStartDate(normalizedInvoices[normalizedInvoices.length - 1]?.periodStart || today)
      setRenewalDate(normalizedInvoices[0]?.periodEnd || addYears(today, 1))
      setIsLoading(false)
    }

    loadInvoices()
  }, [authLoading, enabled, user?.id])

  return useMemo(
    () => ({
      enabled,
      startDate,
      renewalDate,
      invoices,
      isLoading,
      refresh: async () => {
        if (!user) return
        const { data, error } = await supabase
          .from('invoices')
          .select('*, community:community_id(name, membership_tier)')
          .eq('user_id', user.id)
          .order('period_start', { ascending: false })
        if (error) {
          console.error('Error refreshing invoices:', error)
          setIsLoading(false)
          return
        }
        const normalized = (data || []).map((inv) => ({
          id: inv.id,
          invoice_no: Number(inv.invoice_no),
          userId: inv.user_id,
          issueDate: inv.issue_date,
          periodStart: inv.period_start,
          periodEnd: inv.period_end,
          amountCents: Number(inv.amount_cents),
          currency: inv.currency,
          status: inv.status,
          communityId: inv.community_id,
          communityName: inv.community?.name,
          communityTier: inv.community?.membership_tier as 'gold' | 'silver' | undefined,
        }))
        setInvoices(withDiscountedAmounts(normalized))
        setIsLoading(false)
      },
    }),
    [enabled, startDate, renewalDate, invoices, isLoading, user?.id]
  )
}
