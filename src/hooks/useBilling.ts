import { useEffect, useState, useMemo } from 'react'
import { useAuth } from './useAuth'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const client = createClient(supabaseUrl, supabaseAnonKey)

function formatYMD(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addYears(ymd: string, years: number) {
  const date = new Date(ymd)
  date.setFullYear(date.getFullYear() + years)
  return formatYMD(date)
}

export function useBilling() {
  const { user, isAdmin, isCommunityManager } = useAuth()
  const enabled = !!user && (isAdmin || isCommunityManager)
  const [invoices, setInvoices] = useState<any[]>([])
  const [startDate, setStartDate] = useState<string | null>(null)
  const [renewalDate, setRenewalDate] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !user) return

    async function loadInvoices() {
      const today = formatYMD(new Date())

      const { data: existingInvoices, error } = await client
        .from('invoices')
        .select('*')
        .eq('user_id', user?.id)
        .order('period_start', { ascending: false })

      if (error) {
        console.error('Error fetching invoices:', error)
        return
      }

      let invoicesToSet = existingInvoices || []

      if (invoicesToSet.length === 0) {
        const currentStart = today
        const currentEnd = addYears(today, 1)

        const { data: inserted, error: insertError } = await client
          .from('invoices')
          .insert([
            {
              user_id: user?.id,
              issue_date: today,
              period_start: currentStart,
              period_end: currentEnd,
              amount_cents: 10000,
              currency: 'USD',
              status: 'issued',
            },
          ])
          .select()

        if (insertError) {
          console.error('Error inserting invoice:', insertError)
          return
        }

        invoicesToSet = inserted || []
      }

      const normalizedInvoices = invoicesToSet.map((inv) => ({
        invoice_no: Number(inv.invoice_no),
        userId: inv.user_id,
        issueDate: inv.issue_date,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        amountCents: Number(inv.amount_cents),
        currency: inv.currency,
        status: inv.status,
      }))

      setInvoices(normalizedInvoices)
      setStartDate(normalizedInvoices[normalizedInvoices.length - 1]?.periodStart || today)
      setRenewalDate(normalizedInvoices[0]?.periodEnd || addYears(today, 1))
    }

    loadInvoices()
  }, [enabled, user?.id])

  return useMemo(
    () => ({
      enabled,
      startDate,
      renewalDate,
      invoices,
      refresh: async () => {
        if (!user) return
        const { data, error } = await client
          .from('invoices')
          .select('*')
          .eq('user_id', user.id)
          .order('period_start', { ascending: false })
        if (error) {
          console.error('Error refreshing invoices:', error)
          return
        }
        setInvoices(
          (data || []).map((inv) => ({
            invoice_no: Number(inv.invoice_no),
            userId: inv.user_id,
            issueDate: inv.issue_date,
            periodStart: inv.period_start,
            periodEnd: inv.period_end,
            amountCents: Number(inv.amount_cents),
            currency: inv.currency,
            status: inv.status,
          }))
        )
      },
    }),
    [enabled, startDate, renewalDate, invoices, user?.id]
  )
}
