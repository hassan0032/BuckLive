import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAdminInvoices } from '../hooks/useAdminInvoices'
import { Loader2 } from 'lucide-react'
import { InvoicesTable } from './common/InvoicesTable'
import { Info } from 'lucide-react'

function Invoices() {

  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { invoices, selectedCommunityId, isLoading, error, updateInvoiceStatus, deleteInvoice } = useAdminInvoices()

  const canView = !!user && isAdmin

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

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[#363f49]">Community Invoices</h1>
          <p className="text-gray-600 mt-1">View and manage invoices for all communities.</p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3 text-blue-800">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed">
          Please note: The invoice for a new community is generated automatically 24 hours after creation.
        </p>
      </div>

      <InvoicesTable
        invoices={invoices}
        isLoading={isLoading}
        error={error}
        isAdmin={true}
        updateInvoiceStatus={updateInvoiceStatus}
        currentUser={user}
        emptyMessage={selectedCommunityId ? 'No invoices found matching the selected community.' : 'No invoices found.'}
        deleteInvoice={deleteInvoice}
      />
    </div>
  )
}

export default Invoices