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
  const paddedNumber = invoiceNo.toString().padStart(4, '0');
  const prefix = (communityCode ?? '').trim() || 'NO-COMMUNITY';
  return `${prefix} - ${paddedNumber}`;
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
  communityId?: string | null
  issueDate?: string | null
  periodStart?: string | null
  communityTier?: 'gold' | 'silver' | undefined
  amountCents?: number
  createdAt?: string | null
}

function getInvoiceKey(inv: PricingInput) {
  return inv.id ?? `${inv.userId ?? 'unknown'}-${inv.invoice_no}`
}

function getInvoiceSortDate(inv: PricingInput) {
  return inv.issueDate || inv.periodStart || ''
}

export function withDiscountedAmounts<T extends PricingInput>(invoices: T[]): Array<T & { calculatedAmountCents?: number }> {
  // 1. Group by User
  const invoicesByUser = invoices.reduce<Map<string, T[]>>((acc, invoice) => {
    const key = invoice.userId ?? 'unknown'
    if (!acc.has(key)) {
      acc.set(key, [])
    }
    acc.get(key)!.push(invoice)
    return acc
  }, new Map())

  const calculatedMap = new Map<string, number>()

  invoicesByUser.forEach((userInvoices) => {
    // 2. Group by Community within User
    const invoicesByCommunity = userInvoices.reduce<Map<string, T[]>>((acc, invoice) => {
      const communityKey = invoice.communityId ?? 'unknown'
      if (!acc.has(communityKey)) {
        acc.set(communityKey, [])
      }
      acc.get(communityKey)!.push(invoice)
      return acc
    }, new Map())

    // 3. Determine Community Rank based on earliest invoice/start date
    const communityMeta = Array.from(invoicesByCommunity.entries()).map(([communityId, communityInvoices]) => {
      // Find the earliest date associated with this community
      const earliestInvoice = communityInvoices.reduce((earliest, current) => {
        const earliestDate = new Date(getInvoiceSortDate(earliest)).getTime()
        const currentDate = new Date(getInvoiceSortDate(current)).getTime()

        if (earliestDate === currentDate) {
          // Tie-breaker: createdAt
          const earliestCreated = new Date(earliest.createdAt || '').getTime()
          const currentCreated = new Date(current.createdAt || '').getTime()
          return currentCreated < earliestCreated ? current : earliest
        }

        return currentDate < earliestDate ? current : earliest
      })

      return {
        communityId,
        startDate: getInvoiceSortDate(earliestInvoice),
        createdAt: earliestInvoice.createdAt,
        invoices: communityInvoices
      }
    })

    // Sort communities to determine rank
    communityMeta.sort((a, b) => {
      const aDate = new Date(a.startDate).getTime()
      const bDate = new Date(b.startDate).getTime()

      if (aDate === bDate) {
        const aCreated = new Date(a.createdAt || '').getTime()
        const bCreated = new Date(b.createdAt || '').getTime()
        return aCreated - bCreated
      }

      return aDate - bDate
    })

    // 4. Calculate price for each invoice based on its community's rank
    communityMeta.forEach((meta, rank) => {
      meta.invoices.forEach(invoice => {
        const price = calculateCommunityPrice(rank, invoice.communityTier ?? 'silver')
        calculatedMap.set(getInvoiceKey(invoice), price * 100)
      })
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
      * {
          box-sizing: border-box;
      }

      body {
          font-family: Arial, sans-serif;
          background: #fff;
          color: #000;
          margin: 0;
          padding: 0;
      }

      .invoice-wrapper {
          width: 100%;
          max-width: 800px;
          min-height: 1090px;
          margin: 0 auto;
          padding: 40px 50px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          page-break-inside: avoid;
          page-break-after: avoid;
      }
      
      .content-top {
          flex: 0 0 auto;
      }
      
      .content-bottom {
          margin-top: auto;
      }

      .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 50px;
      }
      
      .logo {
          width: 200px;
          display: block;
      }

      .brand {
          font-size: 1.1rem;
          font-weight: 600;
          color: #000;
          margin: 8px 0 0 0;
      }

      .brand-address {
          font-size: 0.85rem;
          color: #666;
          margin: 4px 0 0 0;
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
          margin: 8px 0 0 0;
      }

      .main-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 35px;
      }

      .bill-to {
          width: 400px;
      }

      .bill-to-label {
          font-size: 0.85rem;
          color: #666;
          margin: 0 0 4px 0;
      }

      .bill-to-name {
          font-weight: 700;
          color: #000;
          margin: 0 0 2px 0;
      }

      .bill-to-email {
          color: #666;
          font-size: 0.9rem;
          margin: 0;
      }

      .date-balance {
          flex: 1;
          text-align: right;
      }

      .date-row {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin-bottom: 10px;
          font-size: 0.9rem;
      }

      .date-label {
          color: #666;
          margin: 0 20px 0 0;
      }

      .date-value {
          color: #000;
          margin: 0;
      }

      .balance-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 15px;
          background: #f5f5f5;
      }

      .balance-label {
          font-weight: 700;
          color: #000;
          margin: 0;
      }

      .balance-amount {
          font-weight: 700;
          font-size: 1.1rem;
          color: #000;
          margin: 0;
      }

      table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
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
          margin-top: 20px;
      }

      .total-row {
          display: flex;
          justify-content: flex-end;
          padding: 0 12px 10px 12px;
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
          padding-top: 10px;
          margin-top: 5px;
      }

      .final-total .total-label {
          color: #000;
          font-size: 1.05rem;
      }
        
      .details {
          font-size: 14px;
          margin: 0 0 4px 0;
      }

      .checks {
          margin: 8px 0;
      }

      .reference {
          font-size: 14px;
          margin: 8px 0 0 0;
      }

      .payment-details {
          page-break-inside: avoid;
      }

      .payment-title {
          margin: 0 0 8px 0;
      }

      .ach {
          margin: 0 0 4px 0;
          font-weight: bold;
      }

      /* Safari-specific fixes */
      @media print {
          .invoice-wrapper {
              height: auto;
              min-height: 0;
          }
      }
  </style>

  <div class="invoice-wrapper">
    <div class="content-top">
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
          ${discountPercent > 0 ? `
            <div class="total-row">
              <p class="total-label">Discount (${discountPercent}%):</p>
              <p class="total-value">-${discountAmountDisplay}</p>
            </div>
          ` : ''}
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

    <div class="content-bottom">
      <div class="payment-details">
        <p class="payment-title"><b>Payment Due Upon Receipt</b></p>
        <p class="details checks"><b>Checks:</b> Payable to Buck Institute for Research on Aging, 8001 Redwood Blvd., Novato, CA 94945</p>
        <p class="ach"><b>ACH or Wire:</b></p>
        <p class="details">Bank Name: BMO Harris Bank NA</p>
        <p class="details">Acct Name: Buck Institute for Research on Aging</p>
        <p class="details">Acct #: 1821008</p>
        <p class="details">ABA: 071000288</p>
        <p class="details">SWIFT: HATRUS44</p>
        <p class="reference">Please reference the invoice number with all payments.</p>
      </div>
    </div>
  </div>
`

  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)

  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number], // Reduced margins for Safari
    filename: `invoice-${invoiceNo}.pdf`,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      windowHeight: 1123, // A4 height in pixels at 96 DPI
    },
    jsPDF: {
      unit: "pt",
      format: "a4",
      orientation: "portrait" as const,
      compress: true
    },
    pagebreak: { mode: 'avoid-all' }
  }

  return { container, opt }
}