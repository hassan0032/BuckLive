import { Loader2, Info, Download } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useOrganizationInvoices } from '../hooks/useOrganizationInvoices'
import { InvoicesTable } from './common/InvoicesTable'
import { downloadInvoicesCSV } from '../utils/helper'

export function OrganizationInvoices() {
  const { user, isOrganizationManager, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { invoices, loading: invoicesLoading, error, pendingCommunities, isGenerating, generateNow } = useOrganizationInvoices()

  const canView = isOrganizationManager

  useEffect(() => {
    if (!authLoading && (!user || !canView)) {
      navigate('/library')
    }
  }, [authLoading, user, canView, navigate])

  const handleGenerateNow = async () => {
    try {
      await generateNow()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to generate invoices')
    }
  }

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-[#363f49]">Invoices</h1>
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
            Invoices are generated based on the community's activation date so you can benefit from volume discounts.{pendingCommunities.length > 0 && (
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
