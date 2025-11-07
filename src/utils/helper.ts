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
export function formatInvoiceNumber(invoiceNo: number, issueDate: string | Date | null): string {
  const date = issueDate ? new Date(issueDate) : new Date();
  const year = date.getFullYear();
  const paddedNumber = invoiceNo.toString().padStart(4, '0');
  return `BUCK-${year}-${paddedNumber}`;
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
}: InvoicePdfData) {
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
          padding: 12px;
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
          <p class="balance-amount">${amount}</p>
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
          <td class="community-name">${community} - ${tier} - ${periodStart} - ${periodEnd}</td>
          <td>${amount}</td>
          <td>${amount}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals-section">
      <div class="total-row">
        <p class="total-label">Subtotal:</p>
        <p class="total-value">${amount}</p>
      </div>
      <div class="total-row final-total">
        <p class="total-label">Total:</p>
        <p class="total-value">${amount}</p>
      </div>
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