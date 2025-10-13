import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ContentVersion } from '../types';
import { Clock, RotateCcw, X, Loader } from 'lucide-react';

interface VersionHistoryProps {
  contentId: string;
  onRestore: (version: ContentVersion) => void;
  onClose: () => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  contentId,
  onRestore,
  onClose,
}) => {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchVersions();
  }, [contentId]);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('content_versions')
        .select('*')
        .eq('content_id', contentId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error fetching versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (version: ContentVersion) => {
    if (
      window.confirm(
        `Are you sure you want to restore to version ${version.version_number}? This will overwrite the current content.`
      )
    ) {
      onRestore(version);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Version History</h2>
            <p className="text-sm text-gray-600 mt-1">
              {versions.length} version{versions.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <Loader className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No version history available yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Versions will be created automatically when you save changes
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {showPreview && selectedVersion ? (
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Version {selectedVersion.version_number} Preview
                  </h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Back to list
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Title</label>
                    <p className="text-gray-900 mt-1">{selectedVersion.title}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Description</label>
                    <p className="text-gray-900 mt-1">{selectedVersion.description}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Content</label>
                    <div
                      className="prose max-w-none mt-2 p-4 bg-gray-50 rounded-lg"
                      dangerouslySetInnerHTML={{ __html: selectedVersion.blog_content }}
                    />
                  </div>
                  {selectedVersion.change_summary && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Change Summary
                      </label>
                      <p className="text-gray-900 mt-1">{selectedVersion.change_summary}</p>
                    </div>
                  )}
                  <div className="pt-4 border-t">
                    <button
                      onClick={() => handleRestore(selectedVersion)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore This Version
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Version {version.version_number}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatDate(version.created_at)}
                          </span>
                        </div>
                        <h4 className="text-lg font-medium text-gray-900 mb-1">
                          {version.title}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {version.description}
                        </p>
                        {version.change_summary && (
                          <p className="text-sm text-gray-700 italic">
                            "{version.change_summary}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => {
                            setSelectedVersion(version);
                            setShowPreview(true);
                          }}
                          className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleRestore(version)}
                          className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Restore
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
