import html2pdf from 'html2pdf.js'
import { Calendar, Check, Download, Edit2, Loader2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAdminInvoices } from '../hooks/useAdminInvoices'
import { formatInvoiceStatus, INVOICE_STATUS, InvoiceStatus, parseInvoiceStatus } from '../types'
import { formatInvoiceNumber, generateInvoicePdf } from '../utils/helper'

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}

function Invoices() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { invoices, selectedCommunityId, isLoading, error, updateInvoiceStatus } = useAdminInvoices()

  const canView = !!user && isAdmin

  // State for editing invoice status
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus>(INVOICE_STATUS.ISSUED)
  const [customStatusText, setCustomStatusText] = useState<string>('')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  // State for filtering by status
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('')

  const rows = useMemo(
    () => {
      let filteredInvoices = invoices

      // Filter by status if selected
      if (selectedStatusFilter) {
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
    [invoices, selectedStatusFilter]
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
      tier: inv.communityTier ? inv.communityTier.charAt(0).toUpperCase() + inv.communityTier.slice(1) : 'Tier',
      billToName: inv.communityName ? `${inv.communityName} Management` : 'Community Manager',
      billToEmail: '',
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
    if (!invoiceId) return

    // Validate custom text if Other is selected
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

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#363f49]">Community Invoices</h1>
          <p className="text-gray-600 mt-1">View and manage invoices for all communities.</p>
        </div>

        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Status
          </label>
          <select
            id="status-filter"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary bg-white"
          >
            <option value="">All Statuses</option>
            <option value={INVOICE_STATUS.ISSUED}>Issued</option>
            <option value={INVOICE_STATUS.PAID}>Paid</option>
            <option value={INVOICE_STATUS.OTHER}>Other</option>
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
          {selectedCommunityId || selectedStatusFilter ? 'No invoices found matching the selected filters.' : 'No invoices found.'}
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
            const formattedInvoiceNo = formatInvoiceNumber(row.invoice_no, row.communityCode)
            return (
              <div key={formattedInvoiceNo} className="grid grid-cols-7 gap-4 px-4 py-4 items-center border-b last:border-b-0">
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
                      <button
                        onClick={() => handleStartEditStatus(row.id, row.status)}
                        className="text-xs text-brand-primary hover:text-brand-primary/80 underline"
                        title="Edit status"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

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