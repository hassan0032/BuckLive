import { useState } from 'react';
import { FileText, Loader2, ExternalLink, Download } from 'lucide-react';
import { useDocuments } from '../hooks/useDocuments';
import { useAuth } from '../contexts/AuthContext';
import { CommunityDocument } from '../types';

const formatDate = (value?: string) => {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

interface DocumentsProps {
  communityId?: string | null;
}

function Documents({ communityId: propCommunityId }: DocumentsProps = {}) {
  const { user } = useAuth();
  const fallbackCommunityId = user?.community_id || user?.profile?.community?.id || null;
  const communityId = propCommunityId !== undefined ? propCommunityId : fallbackCommunityId;
  const { documents, loading, error } = useDocuments(communityId);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (doc: CommunityDocument) => {
    if (downloadingId) return;
    try {
      setDownloadingId(doc.id);
      const response = await fetch(doc.publicUrl);
      if (!response.ok) {
        throw new Error('Unable to download file');
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#363f49]">Documents Library</h1>
        <p className="text-gray-600">All PDFs uploaded to the platform</p>
      </div>

      {!communityId && (
        <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-100 text-sm text-yellow-900">
          Join a community to access its document library.
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-100 text-sm">
          {error}
        </div>
      )}

      {(!communityId && !loading) ? null : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-200">
          <FileText className="h-10 w-10 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-1">No documents yet</p>
          <p className="text-sm text-gray-500">
            Upload PDFs from the Admin Dashboard to see them listed here.
          </p>
        </div>
      ) : (
        <div>
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-brand-primary" />
                  <div>
                    <p className="font-semibold text-[#363f49] break-all">{doc.name}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-400">
                  {formatDate(doc.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-end space-x-2">
                <a
                  href={doc.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-2 text-sm font-semibold text-brand-primary bg-brand-primary/10 rounded-lg hover:bg-brand-primary/20 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View
                </a>
                <button
                  type="button"
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  className="inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-d-blue transition-colors disabled:opacity-50"
                >
                  {downloadingId === doc.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Preparing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Documents;