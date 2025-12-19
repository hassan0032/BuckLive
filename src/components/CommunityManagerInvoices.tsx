import { Loader2, Info } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useBilling } from '../hooks/useBilling'
import { InvoicesTable } from './common/InvoicesTable'

function CommunityManagerInvoices() {
  const { user, isAdmin, isCommunityManager, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { invoices, isLoading: invoicesLoading } = useBilling()

  const canView = isAdmin || isCommunityManager

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
          Please note: Invoices will be generated in 24 hours so you can benefit from volume discounts.
        </p>
      </div>

      <InvoicesTable
        invoices={invoices}
        isLoading={invoicesLoading}
        error={null}
        isAdmin={false}
        currentUser={user}
        // Note: Community Manager can be Org CM or Standalone CM. 
        // The table handles "Bill To" logic based on organizationId in invoice and checks relative to currentUser.
        emptyMessage="No invoices yet."
      />
    </div>
  )
}

export default CommunityManagerInvoices