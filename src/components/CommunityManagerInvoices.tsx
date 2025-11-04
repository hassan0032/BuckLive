import { useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useBilling } from '../hooks/useBilling'
import { Calendar, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import html2pdf from 'html2pdf.js'

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}

function buildInvoiceHtml(opts: {
  id: string
  issueDate: string
  periodStart: string
  periodEnd: string
  amountCents: number
  currency: string
  userEmail: string
  userName: string
}) {
  const { id, issueDate, periodStart, periodEnd, amountCents, currency, userEmail, userName } = opts
  const amount = formatCurrency(amountCents, currency)
  return `
  <div class="invoice-container">
    <header>
      <div class="brand">Buck Live Billing</div>
      <div class="invoice-meta">
        <div><strong>Invoice ID:</strong> ${id}</div>
        <div><strong>Issued Date:</strong> ${new Date(issueDate).toLocaleDateString()}</div>
      </div>
    </header>

    <h1>Annual Membership Invoice</h1>

    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">Billed To</div>
        <div class="info-value info-user">
          <div><strong>Name:</strong> ${userName}</div>
          <div><strong>Email:</strong> ${userEmail}</div>
        </div>
      </div>

      <div class="info-box">
        <div class="info-label">Billing Period</div>
        <div class="info-value period-range">
          <div><strong>From:</strong> ${new Date(periodStart).toLocaleDateString()}</div>
          <div><strong>To:</strong> ${new Date(periodEnd).toLocaleDateString()}</div>
        </div>
      </div>
    </div>

    <div class="total-box">
      <div class="total-label">Total Amount</div>
      <div class="total-amount">${amount}</div>
    </div>

    <footer>
      Thank you for your continued partnership with <strong>Buck Live</strong>.<br />
      For any billing inquiries, contact us at <a href="mailto:billing@bucklive.com">billing@bucklive.com</a>
    </footer>
  </div>
  `
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

  const handleDownload = (id: string) => {
    const inv = invoices.find((i) => i.id === id)
    if (!inv || !user) return

    // ✅ Build HTML
    const html = `
      <style>
        :root {
          --primary: #2563eb;
          --text-dark: #1f2937;
          --text-muted: #6b7280;
          --border: #e5e7eb;
          --bg-card: #ffffff;
          --bg-page: #f9fafb;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          background: var(--bg-page);
          color: var(--text-dark);
          padding: 24px;
          margin: 0;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }
        header {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 32px;
          border-bottom: 2px solid var(--border);
          padding-bottom: 16px;
        }
        .brand {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--primary);
        }
        .invoice-meta {
          text-align: right;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        h1 {
          text-align: center;
          font-size: 1.5rem;
          margin: 24px 0 32px;
          color: var(--text-dark);
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 32px;
        }
        .info-box {
          background: #f3f4f6;
          padding: 16px;
          border-radius: 8px;
        }
        .info-label {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 6px;
        }
        .info-value {
          font-weight: 500;
          font-size: 0.95rem;
        }
        .total-box {
          margin-top: 32px;
          border-top: 2px solid var(--border);
          padding-top: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .total-label {
          font-size: 1.1rem;
          font-weight: 600;
        }
        .total-amount {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--primary);
        }
        footer {
          text-align: center;
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 40px;
          line-height: 1.6;
        }
        a {
          color: var(--primary);
          text-decoration: none;
        }
        @media (max-width: 768px) {
          .info-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
      ${buildInvoiceHtml({
      id: inv.id,
      issueDate: inv.issueDate,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      amountCents: inv.amountCents,
      currency: inv.currency,
      userEmail: user.email,
      userName: `${user.profile?.first_name || ''} ${user.profile?.last_name || ''}`.trim(),
    })}
    `

    // ✅ Create a temporary DOM element
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    // ✅ Type-safe options (fixed error here)
    const opt = {
      margin: 0.5,
      filename: `invoice-${inv.id}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" as const },
    }

    html2pdf().set(opt).from(container).save().then(() => {
      document.body.removeChild(container)
    })

  }


  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#363f49]">Invoices</h1>
        <p className="text-gray-600 mt-1">Billing is simulated locally for admins and community managers.</p>
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

          {rows.map((row) => (
            <div key={row.id} className="grid grid-cols-6 gap-4 px-4 py-4 items-center border-b last:border-b-0">
              <div className="col-span-2">
                <div className="text-[#363f49]">
                  {new Date(row.periodStart).toLocaleDateString()} –{' '}
                  {new Date(row.periodEnd).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">ID: {row.id.slice(0, 8)}…</div>
              </div>

              <div className="text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> {new Date(row.issueDate).toLocaleDateString()}
              </div>

              <div className="text-right font-medium">{row.amountDisplay}</div>
              <div className="text-gray-700 capitalize">{row.status}</div>

              <div className="text-right">
                <button
                  onClick={() => handleDownload(row.id)}
                  className="inline-flex items-center gap-2 text-white bg-brand-primary hover:bg-brand-primary/90 px-3 py-2 rounded-md text-sm"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CommunityManagerInvoices
