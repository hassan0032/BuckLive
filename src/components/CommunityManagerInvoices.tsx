import html2pdf from 'html2pdf.js'
import { Calendar, Download } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBilling } from '../hooks/useBilling'
import { formatInvoiceNumber } from '../utils/helper'

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}

function CommunityManagerInvoices() {
  const { user, isAdmin, isCommunityManager } = useAuth()
  const navigate = useNavigate()
  const { invoices, startDate, renewalDate } = useBilling()

  const canView = isAdmin || isCommunityManager

  const rows = useMemo(
    () =>
      invoices.map((inv) => ({
        ...inv,
        amountDisplay: formatCurrency(inv.amountCents, inv.currency),
      })),
    [invoices]
  )

  if (!user || !canView) {
    navigate('/library')
    return null
  }

  const handleDownload = (invoice_no: number) => {
    const inv = invoices.find((i) => i.invoice_no === invoice_no)
    if (!inv || !user) return

    const formattedInvoiceNo = formatInvoiceNumber(inv.invoice_no, inv.issueDate)

    const html = `
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #fff;
            color: #000;
            margin: 0;
            padding: 0;
        }

        .invoice-wrapper {
            max-width: 800px;
            margin: 0 auto;
            padding: 50px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 60px;
        }

        .brand {
            font-size: 1.1rem;
            font-weight: 700;
            color: #000;
        }

        .brand-address {
            font-size: 0.85rem;
            color: #666;
            margin-top: 4px;
        }

        .invoice-title-section {
            text-align: right;
        }

        .invoice-title {
            font-size: 2.5rem;
            font-weight: 400;
            letter-spacing: 2px;
            color: #000;
            margin: 0;
        }

        .invoice-number {
            font-size: 0.9rem;
            color: #666;
            margin-top: 8px;
        }

        .main-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }

        .bill-to {
            width: 400px;
        }

        .bill-to-label {
            font-size: 0.85rem;
            color: #666;
        }

        .bill-to-name {
            font-weight: 700;
            color: #000;
            margin-bottom: 2px;
        }

        .bill-to-email {
            color: #666;
            font-size: 0.9rem;
        }

        .date-balance {
            flex: 1;
            text-align: right;
            padding: 20px;
        }

        .date-row {
            display: flex;
            justify-content: end;
            align-items: center;
            margin-bottom: 12px;
            font-size: 0.9rem;
        }

        .date-label {
            color: #666;
            margin-right: 20px;
        }

        .date-value {
            color: #000;
        }

        .balance-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-left: 15px;
            padding-right: 15px;
            padding-bottom: 15px;
            background: #f5f5f5;
        }

        .balance-label {
            font-weight: 700;
            color: #000;
        }

        .balance-amount {
            font-weight: 700;
            font-size: 1.1rem;
            color: #000;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        thead {
            background: #4a4a4a;
            color: #fff;
        }

        thead th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 0.9rem;
        }

        thead th:last-child,
        tbody td:last-child {
            text-align: right;
        }

        tbody td {
            padding: 12px;
            border-bottom: 1px solid #e5e5e5;
            color: #000;
            font-size: 0.9rem;
        }

        .totals-section {
            text-align: right;
            margin-top: 30px;
        }

        .total-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 8px;
            font-size: 0.95rem;
        }
        
        .community-name {
            font-weight: 600;
        }

        .total-label {
            margin-right: 40px;
            color: #666;
        }

        .total-value {
            min-width: 120px;
            color: #000;
        }

        .final-total {
            border-top: 1px solid #ddd;
            padding-top: 8px;
            margin-top: 8px;
        }

        .final-total .total-label {
            color: #000;
            font-size: 1.05rem;
        }
    </style>

    <div class="invoice-wrapper">
      <div class="header">
        <div>
          <p class="brand">Buck LIVE</p>
          <p class="brand-address">8001 Redwood Blvd. Novato, CA 94945</p>
        </div>
        <div class="invoice-title-section">
          <p class="invoice-title">INVOICE</p>
          <div class="invoice-number"># ${formattedInvoiceNo}</div>
        </div>
      </div>

      <div class="main-info">
        <div class="bill-to">
          <p class="bill-to-label">Bill To:</p>
          <p class="bill-to-name">${user.profile?.first_name || ''} ${user.profile?.last_name || ''}</p>
          <p class="bill-to-email">${user.email}</p>
        </div>
        <div class="date-balance">
          <div class="date-row">
            <p class="date-label">Date:</p>
            <p class="date-value">${new Date(inv.issueDate).toLocaleDateString('en-US', {year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
          </div>
          <div class="balance-row">
            <p class="balance-label">Balance Due:</p>
            <p class="balance-amount">${formatCurrency(inv.amountCents, inv.currency)}</p>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="community-name">${inv.communityName || 'Community'} - ${inv.communityTier ? inv.communityTier.charAt(0).toUpperCase() + inv.communityTier.slice(1) : 'Tier'} - ${new Date(inv.periodStart).toLocaleDateString()} - ${new Date(inv.periodEnd).toLocaleDateString()}</td>
            <td>1</td>
            <td>${formatCurrency(inv.amountCents, inv.currency)}</td>
            <td>${formatCurrency(inv.amountCents, inv.currency)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals-section">
        <div class="total-row">
          <p class="total-label">Subtotal:</p>
          <p class="total-value">${formatCurrency(inv.amountCents, inv.currency)}</p>
        </div>
        <div class="total-row final-total">
          <p class="total-label">Total:</p>
          <p class="total-value">${formatCurrency(inv.amountCents, inv.currency)}</p>
        </div>
      </div>
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
