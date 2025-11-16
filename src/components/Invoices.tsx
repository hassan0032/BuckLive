import html2pdf from 'html2pdf.js'
import { Calendar, Download, Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminInvoices } from '../hooks/useAdminInvoices'
import { useAuth } from '../contexts/AuthContext'
import { formatInvoiceNumber, generateInvoicePdf } from '../utils/helper'

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}

function Invoices() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { invoices, communities, selectedCommunityId, setSelectedCommunityId, isLoading, error } = useAdminInvoices()

  const canView = !!user && isAdmin

  const rows = useMemo(
    () =>
      invoices.map((inv) => ({
        ...inv,
        amountDisplay: formatCurrency(inv.amountCents, inv.currency),
      })),
    [invoices]
  )

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    )
  }

  if (!canView) {
    navigate('/library')
    return null
  }

  const handleDownload = (invoice_no: number) => {
    const inv = invoices.find((i) => i.invoice_no === invoice_no)
    if (!inv) return

    const formattedInvoiceNo = formatInvoiceNumber(inv.invoice_no, inv.issueDate)
    const formattedAmount = formatCurrency(inv.amountCents, inv.currency)
    const { container, opt } = generateInvoicePdf({
      invoiceNo: formattedInvoiceNo,
      amount: formattedAmount,
      issueDate: new Date(inv.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      periodStart: new Date(inv.periodStart).toLocaleDateString(),
      periodEnd: new Date(inv.periodEnd).toLocaleDateString(),
      community: inv.communityName || 'Community',
      tier: inv.communityTier ? inv.communityTier.charAt(0).toUpperCase() + inv.communityTier.slice(1) : 'Tier',
      billToName: inv.userName || 'Account Holder',
      billToEmail: inv.userEmail || 'billing@bucklive.com',
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#363f49]">Community Invoices</h1>
        <p className="text-gray-600 mt-1">View and manage invoices for all communities.</p>

        <div className="mt-4">
          <label htmlFor="community-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Community
          </label>
          <select
            id="community-filter"
            value={selectedCommunityId || ''}
            onChange={(e) => setSelectedCommunityId(e.target.value || null)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary bg-white"
          >
            <option value="">All Communities</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 rounded-lg shadow-sm text-red-600">
          Error loading invoices: {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6 bg-white rounded-lg shadow-sm text-gray-600">
          {selectedCommunityId ? 'No invoices found for the selected community.' : 'No invoices found.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 gap-4 px-4 py-3 text-sm font-medium text-gray-500 border-b">
            <div className="col-span-2">Period</div>
            <div>Community</div>
            <div>Issued</div>
            <div className="text-right">Amount</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>

          {rows.map((row) => {
            const formattedInvoiceNo = formatInvoiceNumber(row.invoice_no, row.issueDate)
            return (
              <div key={formattedInvoiceNo} className="grid grid-cols-7 gap-4 px-4 py-4 items-center border-b last:border-b-0">
                <div className="col-span-2">
                  <div className="text-[#363f49]">
                    {new Date(row.periodStart).toLocaleDateString()} –{' '}
                    {new Date(row.periodEnd).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500">ID: {formattedInvoiceNo}</div>
                  {row.userName && (
                    <div className="text-xs text-gray-600 mt-1">
                      {row.userName} {row.userEmail && `(${row.userEmail})`}
                    </div>
                  )}
                </div>

                <div>
                  {row.communityName ? (
                    <div>
                      <div className="text-[#363f49] font-medium">{row.communityName}</div>
                      {row.communityTier && (
                        <div className="text-xs text-gray-500 capitalize">{row.communityTier}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">No community</div>
                  )}
                </div>

                <div className="text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> {new Date(row.issueDate).toLocaleDateString()}
                </div>

                <div className="text-right font-medium">{row.amountDisplay}</div>
                <div className="text-gray-700 capitalize">{row.status}</div>

                <div className="text-right">
                  <button
                    onClick={() => handleDownload(row.invoice_no)}
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

export default Invoices
