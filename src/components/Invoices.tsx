import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAdminInvoices } from '../hooks/useAdminInvoices'
import { Loader2 } from 'lucide-react'
import { InvoicesTable } from './common/InvoicesTable'

function Invoices() {

  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { invoices, selectedCommunityId, isLoading, error, updateInvoiceStatus } = useAdminInvoices()

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

      <InvoicesTable
        invoices={invoices}
        isLoading={isLoading}
        error={error}
        isAdmin={true}
        updateInvoiceStatus={updateInvoiceStatus}
        currentUser={user}
        emptyMessage={selectedCommunityId ? 'No invoices found matching the selected community.' : 'No invoices found.'}
      />
    </div>
  )
}

export default Invoices