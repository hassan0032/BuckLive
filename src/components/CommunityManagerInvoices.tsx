import html2pdf from 'html2pdf.js'
import { Calendar, Download, Loader2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBilling } from '../hooks/useBilling'
import { INVOICE_STATUS } from '../types'
import { cn, formatInvoiceNumber, generateInvoicePdf } from '../utils/helper'

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}

function CommunityManagerInvoices() {
  const { user, isAdmin, isCommunityManager, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { invoices, isLoading: invoicesLoading } = useBilling()

  const canView = isAdmin || isCommunityManager

  const rows = useMemo(
    () =>
      invoices.map((inv) => {
        const amountCentsToDisplay = inv.calculatedAmountCents ?? inv.amountCents
        return {
          ...inv,
          amountCentsToDisplay,
          amountDisplay: formatCurrency(amountCentsToDisplay, inv.currency),
        }
      }),
    [invoices]
  )

  useEffect(() => {
    if (!authLoading && (!user || !canView)) {
      navigate('/library')
    }
  }, [authLoading, user, canView, navigate])

  if (authLoading || invoicesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    )
  }

  if (!user || !canView) return null

  const handleDownload = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId)
    if (!inv || !user) return

    const formattedInvoiceNo = formatInvoiceNumber(inv.invoice_no, inv.communityCode)
    const amountCentsToDisplay = inv.calculatedAmountCents ?? inv.amountCents
    const formattedAmount = formatCurrency(amountCentsToDisplay, inv.currency)
    const { container, opt } = generateInvoicePdf({
      invoiceNo: formattedInvoiceNo,
      amount: formattedAmount,
      issueDate: new Date(inv.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      periodStart: new Date(inv.periodStart).toLocaleDateString(),
      periodEnd: new Date(inv.periodEnd).toLocaleDateString(),
      community: inv.communityName || 'Community',
      tier: inv.communityTier ?? 'silver',
      billToName: `${user.profile?.first_name || ''} ${user.profile?.last_name || ''}`.trim() || 'Account Holder',
      billToEmail: user.email,
    })

    html2pdf()
      .set(opt)
      .from(container)
      .save()
      .then(() => {
        document.body.removeChild(container)
      })
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#363f49] mb-6">Invoices</h1>

      {rows.length === 0 ? (
        <div className="p-6 bg-white rounded-lg shadow-sm text-gray-600">No invoices yet.</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="grid grid-cols-6 gap-4 px-4 py-3 text-sm font-medium text-gray-500 border-b">
            <div className="col-span-2">Period</div>
            <div>Issued</div>
            <div className="text-right">Amount</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>

          {rows.map((row) => {
            const formattedInvoiceNo = formatInvoiceNumber(row.invoice_no, row.communityCode)
            return (
              <div key={formattedInvoiceNo} className="grid grid-cols-6 gap-4 px-4 py-4 items-center border-b last:border-b-0">
                <div className="col-span-2">
                  <div className="text-[#363f49]">
                    {new Date(row.periodStart).toLocaleDateString()} –{' '}
                    {new Date(row.periodEnd).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500">ID: {formattedInvoiceNo}</div>
                  {(row.communityName || row.communityTier) && (
                    <div className="text-xs text-gray-600 mt-1">
                      {row.communityName && <span className="font-medium">{row.communityName}</span>}
                      {row.communityName && row.communityTier && <span> • </span>}
                      {row.communityTier && (
                        <span className="capitalize">{row.communityTier}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> {new Date(row.issueDate).toLocaleDateString()}
                </div>

                <div className="text-right font-medium">{row.amountDisplay}</div>
                {/* <div className="text-gray-700 capitalize">{row.status}</div> */}
                <div className="flex items-center">
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-800 text-xs font-medium',
                      {
                        'bg-green-100 text-green-800': row.status === INVOICE_STATUS.PAID,
                        'bg-blue-100 text-blue-800': row.status === INVOICE_STATUS.ISSUED,
                      }
                    )}
                  >
                    {row.status}
                  </span>
                </div>

                <div className="text-right">
                  <button
                    onClick={() => handleDownload(row.id)}
                    className="inline-flex items-center gap-2 text-white bg-brand-primary hover:bg-brand-primary/90 px-3 py-2 rounded-md text-sm"
                  >
                    <Download className="w-4 h-4" /> Download PDF
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CommunityManagerInvoices