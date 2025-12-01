import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CommunityDocument } from '../types';

interface UploadResult {
  data: { path: string; publicUrl: string } | null;
  error: string | null;
}

const mapRowToDocument = (row: any): CommunityDocument => ({
  id: row.id,
  communityId: row.community_id,
  name: row.name,
  storagePath: row.storage_path,
  publicUrl: row.public_url,
  size: row.size ?? 0,
  createdAt: row.created_at ?? undefined,
  createdBy: row.created_by ?? null,
});

export const useDocuments = (communityId?: string | null) => {
  const [documents, setDocuments] = useState<CommunityDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bucket = useMemo(() => 'documents', []);
  const resolvedCommunityId = communityId ?? null;

  const fetchDocuments = useCallback(async () => {
    if (!resolvedCommunityId) {
      setDocuments([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('community_pdfs')
        .select('*')
        .eq('community_id', resolvedCommunityId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setDocuments((data ?? []).map(mapRowToDocument));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [resolvedCommunityId]);

  const uploadDocument = useCallback(
    async (file: File, fileName: string): Promise<UploadResult> => {
      if (!resolvedCommunityId) {
        const message = 'Select a community before uploading a PDF.';
        setError(message);
        return { data: null, error: message };
      }

      try {
        setUploading(true);
        setError(null);

        const cleanedFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '-');
        const storagePath = `${resolvedCommunityId}/${cleanedFileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from(bucket).getPublicUrl(storagePath);

        const { data: inserted, error: insertError } = await supabase
          .from('community_pdfs')
          .insert({
            community_id: resolvedCommunityId,
            name: file.name,
            storage_path: storagePath,
            public_url: publicUrl,
          })
          .select('*')
          .single();

        if (insertError) throw insertError;

        const document = mapRowToDocument(inserted);
        setDocuments((prev) => [document, ...prev]);

        return { data: { path: storagePath, publicUrl }, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to upload document';
        setError(message);
        return { data: null, error: message };
      } finally {
        setUploading(false);
      }
    },
    [bucket, resolvedCommunityId]
  );

  const deleteDocument = useCallback(
    async (doc: CommunityDocument) => {
      if (!resolvedCommunityId) {
        return { error: 'Select a community before deleting PDFs.' };
      }

      try {
        const { error: removeError } = await supabase.storage
          .from(bucket)
          .remove([doc.storagePath]);

        if (removeError) throw removeError;

        const { error: deleteError } = await supabase
          .from('community_pdfs')
          .delete()
          .eq('id', doc.id);

        if (deleteError) throw deleteError;

        setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
        return { error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete document';
        setError(message);
        return { error: message };
      }
    },
    [bucket, resolvedCommunityId]
  );

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    uploading,
    error,
    uploadDocument,
    deleteDocument,
    refetch: fetchDocuments,
  };
};

