import html2pdf from 'html2pdf.js'
import { Calendar, Check, Download, Edit2, Loader2, X, Trash2 } from 'lucide-react'
import { DeleteConfirmationModal } from './DeleteConfirmationModal'
import { useMemo, useState } from 'react'
import { formatInvoiceStatus, INVOICE_STATUS, Invoice, InvoiceStatus, parseInvoiceStatus, User } from '../../types'
import { formatInvoiceNumber, generateInvoicePdf } from '../../utils/helper'

interface InvoicesTableProps {

  invoices: Invoice[]
  isLoading: boolean
  error: string | null
  isAdmin?: boolean
  updateInvoiceStatus?: (id: string, status: InvoiceStatus, customText?: string) => Promise<void>
  currentUser?: User | null
  emptyMessage?: string
  isOrganizationManager?: boolean
  deleteInvoice?: (id: string) => Promise<void>
}

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}

export function InvoicesTable({
  invoices,
  isLoading,
  error,
  isAdmin = false,
  updateInvoiceStatus,
  currentUser,
  emptyMessage = 'No invoices found.',
  isOrganizationManager = false,
  deleteInvoice
}: InvoicesTableProps) {
  // State for editing invoice status (Admin only)
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus>(INVOICE_STATUS.ISSUED)
  const [customStatusText, setCustomStatusText] = useState<string>('')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  // State for filtering by status (Admin only)
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('')

  const rows = useMemo(
    () => {
      let filteredInvoices = invoices

      // Filter by status if selected (only for admin view usually, but logic is generic)
      if (selectedStatusFilter && isAdmin) {
        filteredInvoices = filteredInvoices.filter((inv) => {
          const parsed = parseInvoiceStatus(inv.status)
          return parsed.type === selectedStatusFilter
        })
      }

      return filteredInvoices.map((inv) => {
        const amountCentsToDisplay = inv.calculatedAmountCents ?? inv.amountCents
        return {
          ...inv,
          amountCentsToDisplay,
          amountDisplay: formatCurrency(amountCentsToDisplay, inv.currency),
        }
      })
    },
    [invoices, selectedStatusFilter, isAdmin]
  )

  const handleDownload = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId)
    if (!inv) return

    const formattedInvoiceNo = formatInvoiceNumber(inv.invoice_no, inv.communityCode)
    const amountCentsToDisplay = inv.calculatedAmountCents ?? inv.amountCents
    const formattedAmount = formatCurrency(amountCentsToDisplay, inv.currency)
    const originalAmount = formatCurrency(inv.amountCents, inv.currency)
    const discountPercent = inv.discountPercentage ?? 0

    // "Bill To" Logic
    let billToName = ''
    let billToEmail = ''
    let lineItemName = inv.communityName || 'Community'

    // Check if invoice belongs to an Org (either by direct ID or derived)
    // Note: invoice.organizationId must be populated by the hook
    const isOrgInvoice = !!inv.organizationId;

    if (isAdmin) {
      if (isOrgInvoice) {
        // Admin - Rule A: Org Community
        billToName = inv.organizationName || 'Organization';
        // Organization invoice: No email in Bill To
        billToEmail = '';
      } else {
        // Admin - Rule B: Standalone Community
        billToName = inv.communityName || 'Community';
        // Standalone invoice: Include CM email
        billToEmail = '';
      }

    } else if (isOrganizationManager) {
      // Organization Manager
      // "Bill To" should be "Organization Name"
      billToName = inv.organizationName || 'Organization';
      // Organization invoice: No email in Bill To
      billToEmail = '';

    } else {
      // Community Manager (Non-Admin, Non-OrgManager implication)
      if (isOrgInvoice) {
        // Org Community Manager
        billToName = currentUser?.profile ? `${currentUser.profile.first_name || ''} ${currentUser.profile.last_name || ''}`.trim() : 'Community Manager';
        // Organization invoice: No email in Bill To
        billToEmail = currentUser?.email || '';
      } else {
        // Standalone Community Manager
        billToName = inv.communityName || 'Community';
        // Standalone invoice: Include CM email
        billToEmail = '';
      }
    }

    // Fallback if empty
    if (!billToName.trim()) billToName = 'Valued Customer';

    const { container, opt } = generateInvoicePdf({
      invoiceNo: formattedInvoiceNo,
      amount: formattedAmount,
      issueDate: new Date(inv.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      periodStart: new Date(inv.periodStart).toLocaleDateString(),
      periodEnd: new Date(inv.periodEnd).toLocaleDateString(),
      community: lineItemName,
      tier: inv.communityTier ?? 'silver',
      billToName,
      billToEmail,
      originalAmount: originalAmount,
      discountPercent: discountPercent,
    })

    html2pdf()
      .set(opt)
      .from(container)
      .save()
      .then(() => {
        document.body.removeChild(container)
      })
  }

  const handleStartEditStatus = (invoiceId: string, currentStatus: string) => {
    const parsed = parseInvoiceStatus(currentStatus)
    setEditingInvoiceId(invoiceId)
    setSelectedStatus(parsed.type)
    setCustomStatusText(parsed.customText || '')
    setStatusError(null)
  }

  const handleCancelEditStatus = () => {
    setEditingInvoiceId(null)
    setSelectedStatus(INVOICE_STATUS.ISSUED)
    setCustomStatusText('')
    setStatusError(null)
  }

  const handleSaveStatus = async (invoiceId: string) => {
    if (!invoiceId || !updateInvoiceStatus) return

    if (selectedStatus === INVOICE_STATUS.OTHER && !customStatusText.trim()) {
      setStatusError('Please enter a custom status')
      return
    }

    setUpdatingStatus(invoiceId)
    setStatusError(null)

    try {
      await updateInvoiceStatus(invoiceId, selectedStatus, customStatusText.trim() || undefined)
      setEditingInvoiceId(null)
      setSelectedStatus(INVOICE_STATUS.ISSUED)
      setCustomStatusText('')
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleDeleteClick = (invoiceId: string) => {
    setInvoiceToDelete(invoiceId)
  }

  const confirmDelete = async () => {
    if (!invoiceToDelete || !deleteInvoice) return

    setIsDeleting(true)
    try {
      await deleteInvoice(invoiceToDelete)
      setInvoiceToDelete(null)
    } catch (err) {
      console.error('Failed to delete invoice:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete invoice')
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    const parsed = parseInvoiceStatus(status)
    if (parsed.type === INVOICE_STATUS.PAID) {
      return 'bg-green-100 text-green-800'
    }
    if (parsed.type === INVOICE_STATUS.ISSUED) {
      return 'bg-blue-100 text-blue-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-lg shadow-sm text-red-600">
        Error loading invoices: {error}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Admin Filter Controls */}
      {isAdmin && (
        <div className="px-4 py-3 border-b flex justify-end">
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
              Filter:
            </label>
            <select
              id="status-filter"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="text-sm border-gray-300 border rounded-md focus:ring-brand-primary focus:border-brand-primary py-1 pl-2 pr-8"
            >
              <option value="">All Statuses</option>
              <option value={INVOICE_STATUS.ISSUED}>Issued</option>
              <option value={INVOICE_STATUS.PAID}>Paid</option>
              <option value={INVOICE_STATUS.OTHER}>Other</option>
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-8 gap-4 px-4 py-3 text-sm font-medium text-gray-500 border-b">
        <div className="col-span-2">Period</div>
        <div>{isAdmin || isOrganizationManager ? 'Community' : 'Community'}</div>
        <div>Tier</div>
        <div>Status</div>
        <div>Issued</div>
        <div className="text-right">Amount</div>
        <div className="text-right">Actions</div>
      </div>

      {!rows.length && (
        <div className="p-6 bg-white rounded-lg shadow-sm text-gray-600">
          {emptyMessage}
        </div>
      )}

      {rows.map((row) => {
        const formattedInvoiceNo = formatInvoiceNumber(row.invoice_no, row.communityCode)
        return (
          <div key={row.id} className="grid grid-cols-8 gap-4 px-4 py-4 items-center border-b last:border-b-0">
            <div className="col-span-2">
              <div className="text-[#363f49]">
                {new Date(row.periodStart).toLocaleDateString()} –{' '}
                {new Date(row.periodEnd).toLocaleDateString()}
              </div>
              <div className="text-xs text-gray-500">ID: {formattedInvoiceNo}</div>
            </div>

            <div>
              {row.communityName ? (
                <div>
                  <div className="text-[#363f49] font-medium">{row.communityName}</div>
                  {/* {row.communityTier && (
                    <div className="text-xs text-gray-500 capitalize">{row.communityTier}</div>
                  )} */}
                  {/* Show Org Name for Admin if available and distinct */}
                  {isAdmin && row.organizationName && (
                    <div className="text-xs text-brand-primary mt-0.5">{row.organizationName}</div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">No community</div>
              )}
            </div>

            <div>{row.communityTier ? row.communityTier.charAt(0).toUpperCase() + row.communityTier.slice(1) : ''}</div>

            <div>
              {editingInvoiceId === row.id ? (
                <div className="space-y-2">
                  <select
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value as InvoiceStatus)
                      if (e.target.value !== INVOICE_STATUS.OTHER) {
                        setCustomStatusText('')
                      }
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    disabled={updatingStatus === row.id}
                  >
                    <option value={INVOICE_STATUS.ISSUED}>Issued</option>
                    <option value={INVOICE_STATUS.PAID}>Paid</option>
                    <option value={INVOICE_STATUS.OTHER}>Other</option>
                  </select>

                  {selectedStatus === INVOICE_STATUS.OTHER && (
                    <input
                      type="text"
                      value={customStatusText}
                      onChange={(e) => setCustomStatusText(e.target.value)}
                      placeholder="Enter custom status"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      disabled={updatingStatus === row.id}
                    />
                  )}

                  {statusError && editingInvoiceId === row.id && (
                    <div className="text-xs text-red-600">{statusError}</div>
                  )}

                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => handleSaveStatus(row.id)}
                      disabled={updatingStatus === row.id}
                      className="inline-flex items-center justify-center gap-1 p-1 text-xs text-brand-primary hover:text-brand-primary/80 disabled:opacity-50"
                    >
                      {updatingStatus === row.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      onClick={handleCancelEditStatus}
                      disabled={updatingStatus === row.id}
                      className="inline-flex items-center justify-center gap-1 p-1 text-xs text-red-500 hover:text-red-500/80 disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${getStatusBadgeColor(row.status)}`}>
                    {formatInvoiceStatus(row.status)}
                  </span>
                  {isAdmin && updateInvoiceStatus && (
                    <button
                      onClick={() => handleStartEditStatus(row.id, row.status)}
                      className="text-xs text-brand-primary hover:text-brand-primary/80 underline"
                      title="Edit status"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> {new Date(row.issueDate).toLocaleDateString()}
            </div>

            <div className="text-right font-medium">{row.amountDisplay}</div>

            <div className="flex justify-end items-center gap-2">
              <button
                title="Download invoice"
                className="items-center rounded-md p-2 bg-brand-primary hover:bg-brand-primary/80 text-xs text-white"
                onClick={() => handleDownload(row.id)}
              >
                <Download className="w-4 h-4" />
              </button>
              {isAdmin && deleteInvoice && (
                <button
                  title="Delete invoice"
                  className="rounded-md p-2 bg-red-500 hover:bg-red-500/80 text-xs text-white"
                  onClick={() => handleDeleteClick(row.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )
      })}
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={!!invoiceToDelete}
        onClose={() => setInvoiceToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        isDeleting={isDeleting}
      />
    </div>
  )
}
