import { useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Generate random token for public link
function generateToken(length = 12) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

// Build public link from token
function buildPublicLink(token?: string | null) {
  if (!token) return null;
  return `${window.location.origin}/public/${token}`;
}

export function usePublicShareLink(communityId?: string) {
  const [loading, setLoading] = useState(false);
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPublicLink = useCallback(async () => {
    if (!communityId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("sharable_token, is_sharable")
        .eq("id", communityId)
        .single();
      if (error) throw error;
      
      setIsEnabled(!!data?.is_sharable);
      
      if (data?.is_sharable && data?.sharable_token) {
        setPublicLink(buildPublicLink(data.sharable_token));
      } else {
        setPublicLink(null);
      }
    } catch (err: any) {
      setError(err?.message || "Error fetching public link.");
      console.error("Error fetching public link:", err);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  // Generate/regenerate token AND enable sharing
  const generateOrRegenerateToken = useCallback(async () => {
    if (!communityId) return;
    setLoading(true);
    setError(null);
    try {
      const token = generateToken();
      const { error } = await supabase
        .from("communities")
        .update({ 
          sharable_token: token,
          is_sharable: true  // Always enable when generating token
        })
        .eq("id", communityId);
      if (error) throw error;
      await fetchPublicLink();
    } catch (err: any) {
      setError(err?.message || "Error generating/regenerating token.");
      console.error("Error generating/regenerating token:", err);
    } finally {
      setLoading(false);
    }
  }, [communityId, fetchPublicLink]);

  // Enable/disable public sharing
  const setShareableStatus = useCallback(async (status: boolean) => {
    if (!communityId) return;
    setLoading(true);
    setError(null);
    try {
      // If enabling and no token exists, generate one
      if (status) {
        const { data: currentData } = await supabase
          .from("communities")
          .select("sharable_token")
          .eq("id", communityId)
          .single();
        
        const token = currentData?.sharable_token || generateToken();
        
        const { error } = await supabase
          .from("communities")
          .update({ 
            is_sharable: status,
            sharable_token: token
          })
          .eq("id", communityId);
        if (error) throw error;
      } else {
        // If disabling, just update is_sharable
        const { error } = await supabase
          .from("communities")
          .update({ is_sharable: status })
          .eq("id", communityId);
        if (error) throw error;
      }
      
      await fetchPublicLink();
    } catch (err: any) {
      setError(err?.message || "Error updating shareable status.");
      console.error("Error updating shareable status:", err);
    } finally {
      setLoading(false);
    }
  }, [communityId, fetchPublicLink]);

  const copyLink = useCallback(async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      alert("Link copied to clipboard!");
    } catch {
      alert("Failed to copy link");
    }
  }, [publicLink]);

  return {
    loading,
    publicLink,
    isEnabled,
    fetchPublicLink,
    setShareableStatus,
    generateOrRegenerateToken,
    copyLink,
    error,
  };
}