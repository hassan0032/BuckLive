import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ShareTokenInfo {
  community_id: string;
  membership_tier: 'silver' | 'gold';
  name: string;
}

export const usePublicShare = (token: string) => {
  const [shareInfo, setShareInfo] = useState<ShareTokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No share token provided');
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        // Call the validation function
        const { data, error: validateError } = await supabase
          .rpc('validate_share_token', { token });

        if (validateError) {
          throw validateError;
        }

        if (!data || data.length === 0) {
          setError('Invalid or disabled share link');
          setShareInfo(null);
        } else {
          const info = data[0];
          setShareInfo({
            community_id: info.community_id,
            membership_tier: info.membership_tier as 'silver' | 'gold',
            name: info.name,
          });

          // Set the token in session for RLS policies
          // Note: This might not persist across queries, so we'll validate at app level too
          await supabase.rpc('set_share_token', { token });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to validate share token');
        setShareInfo(null);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  return { shareInfo, loading, error };
};

