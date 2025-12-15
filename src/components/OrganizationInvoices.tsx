import { Loader2, Info } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useOrganizationInvoices } from '../hooks/useOrganizationInvoices'
import { InvoicesTable } from './common/InvoicesTable'

export function OrganizationInvoices() {
  const { user, isOrganizationManager, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { invoices, loading: invoicesLoading, error } = useOrganizationInvoices()

  const canView = isOrganizationManager

  useEffect(() => {
    if (!authLoading && (!user || !canView)) {
      navigate('/library')
    }
  }, [authLoading, user, canView, navigate])

  if (authLoading || invoicesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    )
  }

  if (!user || !canView) return null

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#363f49] mb-6">Invoices</h1>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3 text-blue-800">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed">
          Please note: The invoice for a new community is generated automatically 24 hours after creation.
        </p>
      </div>

      <InvoicesTable
        invoices={invoices}
        isLoading={invoicesLoading}
        error={error}
        isAdmin={false}
        currentUser={user}
        isOrganizationManager={true}
        emptyMessage="No invoices found for your organization."
      />
    </div>
  )
}
