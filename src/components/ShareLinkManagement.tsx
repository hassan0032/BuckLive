import { Check, Copy, Link2, RefreshCw } from 'lucide-react';
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Community } from '../types';

interface ShareLinkManagementProps {
  community: Community;
  onUpdate: (updates: Partial<Community>) => void;
}

export const ShareLinkManagement: React.FC<ShareLinkManagementProps> = ({
  community,
  onUpdate,
}) => {
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [updatingShareLink, setUpdatingShareLink] = useState(false);
  const [regeneratingToken, setRegeneratingToken] = useState(false);

  const generateShareToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleToggleShareLink = async (enabled: boolean) => {
    setUpdatingShareLink(true);
    try {
      const updateData: any = { is_sharable: enabled };

      let newToken: string | undefined = community.sharable_token || undefined;

      if (enabled && !community.sharable_token) {
        newToken = generateShareToken();
        updateData.sharable_token = newToken;
      }

      const { error } = await supabase
        .from('communities')
        .update(updateData)
        .eq('id', community.id);

      if (error) throw error;

      onUpdate({
        is_sharable: enabled,
        sharable_token: newToken,
      });
    } catch (err) {
      console.error('Error updating share link:', err);
      alert('Failed to update share link. Please try again.');
    } finally {
      setUpdatingShareLink(false);
    }
  };

  const handleRegenerateToken = async () => {
    setUpdatingShareLink(true);
    setRegeneratingToken(true);
    try {
      const newToken = generateShareToken();
      const { error } = await supabase
        .from('communities')
        .update({ sharable_token: newToken })
        .eq('id', community.id);

      if (error) throw error;

      onUpdate({
        sharable_token: newToken,
      });
    } catch (err) {
      console.error('Error regenerating token:', err);
      alert('Failed to regenerate token. Please try again.');
    } finally {
      setUpdatingShareLink(false);
      setRegeneratingToken(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!community.sharable_token) return;

    const shareLink = `${window.location.origin}/public/${community.sharable_token}`;
    navigator.clipboard.writeText(shareLink).then(() => {
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-[#363f49] mb-4 flex items-center">
        <Link2 className="h-5 w-5 mr-2 text-brand-primary" />
        Public Share Link
      </h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-3">
              Allow anonymous users to view your community's content without logging in.
            </p>
            <div className="flex items-center">
              <input
                id={`communityToggle-${community.id}`}
                type="checkbox"
                checked={community.is_sharable || false}
                onChange={(e) => handleToggleShareLink(e.target.checked)}
                disabled={updatingShareLink}
                className="sr-only"
              />

              <label
                htmlFor={`communityToggle-${community.id}`}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors 
                ${(community.is_sharable || false) ? 'bg-brand-primary' : 'bg-gray-300'}
                ${updatingShareLink ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform 
                  ${(community.is_sharable || false) ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </label>

              <label
                htmlFor={`communityToggle-${community.id}`}
                className="ml-3 text-sm font-medium text-gray-700 cursor-pointer"
              >
                {community.is_sharable ? 'Enabled' : 'Disabled'}
              </label>
            </div>
          </div>
        </div>

        {community.is_sharable && community.sharable_token && (
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Share Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/public/${community.sharable_token}`}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-d-blue transition-colors text-sm font-medium"
                >
                  {shareLinkCopied ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
            <div>
              <button
                onClick={handleRegenerateToken}
                disabled={updatingShareLink}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${regeneratingToken ? 'animate-spin' : ''}`} />
                Regenerate Token
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Regenerating the token will invalidate the current share link. You'll need to share the new link.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
