import { Loader2 } from 'lucide-react'
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
