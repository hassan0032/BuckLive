import React, { useEffect } from "react";
import { Copy, RefreshCw, EyeOff } from "lucide-react";
import { usePublicShareLink } from "../hooks/usePublicShareLink";

interface Props {
  communityId?: string;
}

export const PublicShareLinkManager: React.FC<Props> = ({ communityId }) => {
  const {
    loading,
    publicLink,
    isEnabled,
    fetchPublicLink,
    setShareableStatus,
    generateOrRegenerateToken,
    copyLink,
    error,
  } = usePublicShareLink(communityId);

  useEffect(() => {
    fetchPublicLink();
  }, [fetchPublicLink]);

  if (!communityId) return null;

  if (loading) {
    return <div className="mt-3 text-sm text-gray-500 animate-pulse">Loading public link settings...</div>;
  }

  return (
    <div className="mt-4 space-y-3">
      {error && (
        <div className="bg-red-100 text-red-700 text-sm px-3 py-2 rounded">
          {error}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShareableStatus(!isEnabled)}
          className={`px-4 py-2 rounded-md text-white text-sm font-medium flex items-center gap-1 ${
            isEnabled ? "bg-red-500 hover:bg-red-600" : "bg-brand-primary hover:bg-brand-d-blue"
          }`}
        >
          {isEnabled ? <EyeOff className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {isEnabled ? "Disable Public Link" : "Enable Public Link"}
        </button>
        <button
          onClick={generateOrRegenerateToken}
          className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors text-sm font-medium flex items-center gap-1"
          disabled={!isEnabled}
        >
          <RefreshCw className="h-4 w-4" />
          Generate/Regenerate Token
        </button>
        {publicLink && (
          <button
            onClick={copyLink}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 rounded-md text-sm hover:bg-gray-300"
          >
            <Copy className="h-4 w-4" />
            Copy
          </button>
        )}
      </div>
      {publicLink && (
        <div className="truncate text-sm text-gray-700">
          <span className="font-medium">Link: </span>
          <a
            href={publicLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primary underline truncate"
          >
            {publicLink}
          </a>
        </div>
      )}
    </div>
  );
};
