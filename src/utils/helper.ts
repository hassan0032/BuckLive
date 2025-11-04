// Class name utility for conditional styles
import { twMerge } from 'tailwind-merge';
import { ClassValue, clsx } from 'clsx';

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