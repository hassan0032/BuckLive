import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAdminInvoices } from '../hooks/useAdminInvoices'
import { Loader2, Download } from 'lucide-react'
import { InvoicesTable } from './common/InvoicesTable'
import { Info } from 'lucide-react'
import { downloadInvoicesCSV } from '../utils/helper'

function Invoices() {
  const { user, isAdmin, isCommunityManager, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { invoices, selectedCommunityId, isLoading, error, pendingCommunities, isGenerating, generateNow, updateInvoiceStatus, deleteInvoice } = useAdminInvoices()

  const canView = !!user && (isAdmin || isCommunityManager)

  const handleGenerateNow = async () => {
    try {
      await generateNow()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to generate invoices')
    }
  }

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
          <h1 className="text-2xl font-semibold text-[#363f49]">Invoices</h1>
          <p className="text-gray-600 mt-1">View and manage invoices</p>
        </div>
        <button
          onClick={() => downloadInvoicesCSV(invoices)}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 flex items-center gap-2 shadow-sm"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="flex justify-between items-center mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3 text-blue-800">
        <div className='flex items-center gap-2'>
          <Info className="w-5 h-5" />
          <p className="text-sm leading-relaxed">
            Invoices will be generated in 24 hours so you can benefit from volume discounts.{pendingCommunities.length > 0 && (
              <> <span className="font-semibold">{pendingCommunities.length}</span> {pendingCommunities.length === 1 ? 'invoice is' : 'invoices are'} pending.</>
            )}
          </p>
        </div>
        {pendingCommunities.length > 0 && (
          <button
            onClick={handleGenerateNow}
            disabled={isGenerating}
            className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-md hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Now'
            )}
          </button>
        )}
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