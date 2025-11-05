import html2pdf from 'html2pdf.js'
import { Calendar, Download, Loader2 } from 'lucide-react'
import { useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBilling } from '../hooks/useBilling'
import { formatInvoiceNumber } from '../utils/helper'

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}

function CommunityManagerInvoices() {
  const { user, isAdmin, isCommunityManager, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { invoices, startDate, renewalDate, isLoading: invoicesLoading } = useBilling()

  const canView = isAdmin || isCommunityManager

  const rows = useMemo(
    () =>
      invoices.map((inv) => ({
        ...inv,
        amountDisplay: formatCurrency(inv.amountCents, inv.currency),
      })),
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (!user || !canView) return null

  const handleDownload = (invoice_no: number) => {
    const inv = invoices.find((i) => i.invoice_no === invoice_no)
    if (!inv || !user) return

    const formattedInvoiceNo = formatInvoiceNumber(inv.invoice_no, inv.issueDate)

    const html = `
    <style>
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        background: #fff;
        color: #111827;
        margin: 0;
        padding: 0;
      }
      .invoice-wrapper {
        max-width: 800px;
        margin: 0 auto;
        padding: 40px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
      }
      .brand {
        color: #2563eb;
        font-size: 1.3rem;
        font-weight: 700;
      }
      .meta {
        font-size: 0.9rem;
        color: #6b7280;
        margin-top: 4px;
      }
      .meta strong {
        color: #111827;
      }
      .divider {
        height: 1px;
        background: #e5e7eb;
        margin: 20px 0;
      }
      h1 {
        text-align: center;
        font-size: 1.5rem;
        font-weight: 700;
        color: #111827;
        margin: 24px 0 28px;
      }
      .section {
        background: #f9fafb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }
      .section .label {
        font-size: 0.9rem;
        color: #6b7280;
        margin-bottom: 6px;
      }
      .section .value {
        font-size: 0.95rem;
        color: #111827;
      }
      .bold {
        font-weight: 600;
      }
      .total-section {
        margin-top: 28px;
        border-top: 1px solid #e5e7eb;
        padding-top: 16px;
      }
      .total-label {
        font-weight: 600;
        font-size: 1rem;
        color: #111827;
      }
      .total-amount {
        font-weight: 700;
        font-size: 1.2rem;
        color: #2563eb;
        margin-top: 4px;
      }
      footer {
        text-align: center;
        font-size: 0.85rem;
        color: #6b7280;
        margin-top: 40px;
        line-height: 1.6;
      }
      a {
        color: #2563eb;
        text-decoration: none;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 20px;
      }
    </style>

    <div class="invoice-wrapper">
      <div class="brand">Buck Live Billing</div>
      <div class="meta">
        <div><strong>Invoice ID:</strong> ${formattedInvoiceNo}</div>
        <div><strong>Issued Date:</strong> ${new Date(inv.issueDate).toLocaleDateString()}</div>
      </div>

      <div class="divider"></div>

      <h1>Annual Membership Invoice</h1>

      <div class="info-grid">
        <div class="section">
          <div class="label">Billed To</div>
          <div class="value"><span class="bold">Name:</span> ${user.profile?.first_name || ''} ${user.profile?.last_name || ''}</div>
        <div class="value"><span class="bold">Email:</span> ${user.email}</div>
      </div>

      <div class="section">
        <div class="label">Billing Period</div>
          <div class="value"><span class="bold">From:</span> ${new Date(inv.periodStart).toLocaleDateString()}</div>
          <div class="value"><span class="bold">To:</span> ${new Date(inv.periodEnd).toLocaleDateString()}</div>
        </div>
      </div>

      <div class="total-section">
        <div class="total-label">Total Amount</div>
        <div class="total-amount">${formatCurrency(inv.amountCents, inv.currency)}</div>
      </div>

      <footer>
        Thank you for your continued partnership with <strong>Buck Live</strong>.<br/>
        For any billing inquiries, contact us at <a href="mailto:billing@bucklive.com">billing@bucklive.com</a>
      </footer>
    </div>
  `
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const opt = {
      margin: 0,
      filename: `invoice-${formattedInvoiceNo}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "pt", format: "a4", orientation: "portrait" as const },
    }

    html2pdf().set(opt).from(container).save().then(() => {
      document.body.removeChild(container)
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#363f49]">Invoices</h1>
        <div className="text-sm text-gray-600 mt-2">
          <div>
            Billing start:{' '}
            <span className="font-medium">
              {startDate ? new Date(startDate).toLocaleDateString() : '-'}
            </span>
          </div>
          <div>
            Next renewal:{' '}
            <span className="font-medium">
              {renewalDate ? new Date(renewalDate).toLocaleDateString() : '-'}
            </span>
          </div>
        </div>
      </div>

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
            const formattedInvoiceNo = formatInvoiceNumber(row.invoice_no, row.issueDate)
            return (
              <div key={formattedInvoiceNo} className="grid grid-cols-6 gap-4 px-4 py-4 items-center border-b last:border-b-0">
                <div className="col-span-2">
                  <div className="text-[#363f49]">
                    {new Date(row.periodStart).toLocaleDateString()} –{' '}
                    {new Date(row.periodEnd).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500">ID: {formattedInvoiceNo}</div>
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

export default CommunityManagerInvoices