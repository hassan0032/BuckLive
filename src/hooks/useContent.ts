import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Content } from '../types';

export const useContent = () => {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [singleContent, setSingleContent] = useState<Content | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);

  const fetchContent = async () => {
    try {
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContent(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const searchContent = async (query: string, type?: string, category?: string, tags?: string[]) => {
    try {
      setLoading(true);
      let queryBuilder = supabase
        .from('content')
        .select('*');

      if (query) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`);
      }

      if (type) {
        queryBuilder = queryBuilder.eq('type', type);
      }

      if (category) {
        queryBuilder = queryBuilder.eq('category', category);
      }

      if (tags && tags.length > 0) {
        queryBuilder = queryBuilder.contains('tags', tags);
      }

      const { data, error } = await queryBuilder.order('created_at', { ascending: false });

      if (error) throw error;
      setContent(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const addContent = async (contentData: Omit<Content, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('content')
        .insert([contentData])
        .select()
        .single();

      if (error) throw error;
      setContent(prev => [data, ...prev]);
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to add content' };
    }
  };

  const updateContent = async (id: string, updates: Partial<Content>) => {
    try {
      const { data, error } = await supabase
        .from('content')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setContent(prev => prev.map(item => item.id === id ? data : item));
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to update content' };
    }
  };

  const deleteContent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setContent(prev => prev.filter(item => item.id !== id));
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to delete content' };
    }
  };

  const fetchContentById = async (id: string) => {
    try {
      setSingleLoading(true);
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setSingleContent(data);
      return { data, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch content';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setSingleLoading(false);
    }
  };

  const fetchRelatedContent = async (contentId: string, category: string, tags: string[], limit: number = 4) => {
    try {
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .neq('id', contentId)
        .or(`category.eq.${category},tags.ov.{${tags.join(',')}}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err) {
      return { data: [], error: err instanceof Error ? err.message : 'Failed to fetch related content' };
    }
  };

  const uploadThumbnail = async (file: Blob, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(fileName);

      return { data: { path: data.path, publicUrl }, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Upload failed' };
    }
  };

  const uploadPDF = async (file: File, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('pdfs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('pdfs')
        .getPublicUrl(fileName);

      return { data: { path: data.path, publicUrl }, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Upload failed' };
    }
  };

  const deleteFile = async (bucket: 'thumbnails' | 'pdfs', path: string) => {
    try {
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw error;
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Delete failed' };
    }
  };

  const saveDraft = async (id: string, draftContent: string) => {
    try {
      const { error } = await supabase
        .from('content')
        .update({ blog_content_draft: draftContent })
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Failed to save draft' };
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  return {
    content,
    loading,
    error,
    singleContent,
    singleLoading,
    searchContent,
    addContent,
    updateContent,
    deleteContent,
    fetchContentById,
    fetchRelatedContent,
    uploadThumbnail,
    uploadPDF,
    deleteFile,
    saveDraft,
    refetch: fetchContent,
  };
};