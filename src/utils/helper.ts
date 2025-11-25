// Class name utility for conditional styles
import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...args: ClassValue[]) {
  return twMerge(clsx(args));
}

/**
 * Format invoice number as BUCK-YYYY-NNNN
 * @param invoiceNo - The invoice number (integer)
 * @param issueDate - The issue date (YYYY-MM-DD format) or Date object
 * @returns Formatted invoice number string (e.g., "BUCK-2025-0001")
 */
export function formatInvoiceNumber(invoiceNo: number, communityCode?: string | null): string {
  const paddedNumber = invoiceNo.toString().padStart(4, '0')
  const prefix = (communityCode ?? '').trim() || 'No Cmmunity'
  return `${prefix} - ${paddedNumber}`
}

const BASE_COMMUNITY_PRICES = {
  silver: 2500,
  gold: 5000,
} as const;

function getDiscountRate(newTotal: number) {
  if (newTotal >= 20) return 0.4;
  if (newTotal >= 10) return 0.36;
  if (newTotal >= 6) return 0.3;

  switch (newTotal) {
    case 5:
      return 0.2;
    case 4:
      return 0.15;
    case 3:
      return 0.1;
    case 2:
      return 0.05;
    default:
      return 0;
  }
}

export function calculateCommunityPrice(existingCommunitiesCount: number, communityType: 'silver' | 'gold') {
  const normalizedExisting = Math.max(0, existingCommunitiesCount || 0);
  const newTotal = normalizedExisting + 1;
  const basePrice = BASE_COMMUNITY_PRICES[communityType] ?? BASE_COMMUNITY_PRICES.silver;
  const discountRate = getDiscountRate(newTotal);

  return Math.round(basePrice * (1 - discountRate));
}

type PricingInput = {
  id?: string
  invoice_no: number
  userId?: string | null
  issueDate?: string | null
  periodStart?: string | null
  communityTier?: 'gold' | 'silver' | undefined
  amountCents?: number
}

function getInvoiceKey(inv: PricingInput) {
  return inv.id ?? `${inv.userId ?? 'unknown'}-${inv.invoice_no}`
}

function getInvoiceSortDate(inv: PricingInput) {
  return inv.issueDate || inv.periodStart || ''
}

export function withDiscountedAmounts<T extends PricingInput>(invoices: T[]): Array<T & { calculatedAmountCents?: number }> {
  const grouped = invoices.reduce<Map<string, T[]>>((acc, invoice) => {
    const key = invoice.userId ?? 'unknown'
    if (!acc.has(key)) {
      acc.set(key, [])
    }
    acc.get(key)!.push(invoice)
    return acc
  }, new Map())

  const calculatedMap = new Map<string, number>()

  grouped.forEach((list) => {
    const sorted = [...list].sort((a, b) => {
      const aDate = new Date(getInvoiceSortDate(a)).getTime()
      const bDate = new Date(getInvoiceSortDate(b)).getTime()
      return aDate - bDate
    })

    sorted.forEach((invoice, index) => {
      const price = calculateCommunityPrice(index, invoice.communityTier ?? 'silver')
      calculatedMap.set(getInvoiceKey(invoice), price * 100)
    })
  })

  return invoices.map((invoice) => {
    const key = getInvoiceKey(invoice)
    const cents = calculatedMap.get(key)
    return {
      ...invoice,
      calculatedAmountCents: cents ?? invoice.amountCents,
    }
  })
}

type InvoicePdfData = {
  invoiceNo: string
  amount: string
  issueDate: string
  periodStart: string
  periodEnd: string
  community: string
  tier: string
  billToName: string
  billToEmail: string
  originalAmount?: string
  discountPercent?: number
}

export function generateInvoicePdf({
  invoiceNo,
  amount,
  issueDate,
  periodStart,
  periodEnd,
  community,
  tier,
  billToName,
  billToEmail,
  originalAmount,
  discountPercent: providedDiscountPercent,
}: InvoicePdfData) {
  // Helpers to parse and format currency consistently
  function parseCurrencyToCents(value?: string) {
    if (!value) return 0
    const cleaned = value.replace(/[^0-9.\-]/g, '')
    if (cleaned === '') return 0
    const num = parseFloat(cleaned)
    if (Number.isNaN(num)) return 0
    return Math.round(num * 100)
  }

  function formatCentsToCurrency(cents: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  }

  // Determine base/original price from tier (2500 for silver, 5000 for gold)
  const tierKey = tier === 'gold' ? 'gold' : 'silver'
  const basePriceCents = (BASE_COMMUNITY_PRICES as any)[tierKey]
    ? (BASE_COMMUNITY_PRICES as any)[tierKey] * 100
    : BASE_COMMUNITY_PRICES.silver * 100

  const origCentsFromArg = parseCurrencyToCents(originalAmount)
  const origCents = origCentsFromArg > 0 ? origCentsFromArg : basePriceCents
  const discountedCents = parseCurrencyToCents(amount)
  const discountCents = Math.max(0, origCents - discountedCents)
  const discountPercent = typeof providedDiscountPercent === 'number'
    ? providedDiscountPercent
    : origCents > 0 ? Number(((discountCents / origCents) * 100).toFixed(2)) : 0

  const originalAmountDisplay = formatCentsToCurrency(origCents)
  const discountedAmountDisplay = formatCentsToCurrency(discountedCents)
  const discountAmountDisplay = formatCentsToCurrency(discountCents)

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
          min-height: 100vh;
          margin: 0 auto;
          padding: 50px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
      }

      .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 60px;
      }
      
      .logo {
          width: 200px;
      }

      .brand {
          font-size: 1.1rem;
          font-weight: 600;
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
          padding-left: 12px;
          padding-right: 12px;
          padding-bottom: 12px;
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
        
      .details {
          font-size: 14px;
      }

      .checks {
          margin-top: 10px;
          margin-bottom: 10px;
      }

      .reference {
          font-size: 14px;
          margin-top: 10px;
      }

      .payment-details {
          margin-top: auto;
      }
  </style>

  <div class="invoice-wrapper">
    <div>
      <div class="header">
        <div>
        <img src="/pdf-logo.png" alt="Logo" class="logo" />
          <p class="brand">Buck Institute for Research on Aging</p>
          <p class="brand-address">8001 Redwood Blvd. Novato, CA 94945</p>
        </div>
        <div class="invoice-title-section">
          <p class="invoice-title">INVOICE</p>
          <div class="invoice-number"># ${invoiceNo}</div>
        </div>
      </div>

      <div class="main-info">
        <div class="bill-to">
          <p class="bill-to-label">Bill To:</p>
          <p class="bill-to-name">${billToName}</p>
          <p class="bill-to-email">${billToEmail}</p>
        </div>
        <div class="date-balance">
          <div class="date-row">
            <p class="date-label">Date:</p>
            <p class="date-value">${issueDate}</p>
          </div>
          <div class="balance-row">
            <p class="balance-label">Balance Due:</p>
            <p class="balance-amount">${discountedAmountDisplay}</p>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="community-name">${community} - ${tier} Tier - ${periodStart} - ${periodEnd}</td>
            <td>${originalAmountDisplay}</td>
            <td>${originalAmountDisplay}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals-section">
        <div class="total-row">
          <p class="total-label">Discount (${discountPercent}%):</p>
          <p class="total-value">-${discountAmountDisplay}</p>
        </div>
        <div class="total-row">
          <p class="total-label">Subtotal:</p>
          <p class="total-value">${discountedAmountDisplay}</p>
        </div>
        <div class="total-row final-total">
          <p class="total-label">Total:</p>
          <p class="total-value">${discountedAmountDisplay}</p>
        </div>
      </div>
    </div>

    <div class="payment-details">
      <p class="payment-title">
      <b>Payment Due Upon Receipt</b>
      </p>
      <p class="details checks"><b>Checks:</b> Payable to Buck Institute for Research on Aging, 8001 Redwood Blvd., Novato, CA 94945</p>
      <p class="ach">
      <b>ACH or Wire:</b>
      </p>
      <p class="details">Bank Name: BMO Harris Bank NA</p>
      <p class="details">Acct Name: Buck Institute for Research on Aging</p>
      <p class="details">Acct #: 1821008</p>
      <p class="details">ABA: 071000288</p>
      <p class="details">SWIFT: HATRUS44</p>
      <p class="reference">Please reference the invoice number with all payments.</p>
    </div>
  </div>
`

  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)

  const opt = {
    margin: 0,
    filename: `invoice-${invoiceNo}.pdf`,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "pt", format: "a4", orientation: "portrait" as const },
  }

  return { container, opt }
}