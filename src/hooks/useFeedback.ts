import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ContentFeedback } from '../types';

export interface FeedbackFilters {
  contentId?: string;
  wasHelpful?: boolean;
  startDate?: string;
  endDate?: string;
}

export const useFeedback = () => {
  const [feedback, setFeedback] = useState<ContentFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitFeedback = async (feedbackData: {
    content_id: string;
    name: string;
    email: string;
    comment?: string;
    was_helpful: boolean;
    user_id?: string | null;
  }) => {
    try {
      setError(null);
      const { data, error: insertError } = await supabase
        .from('content_feedback')
        .insert([feedbackData])
        .single();

      if (insertError) throw insertError;
      return { data, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit feedback';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    }
  };

  const fetchFeedback = async (filters?: FeedbackFilters) => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('content_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.contentId) {
        query = query.eq('content_id', filters.contentId);
      }

      if (filters?.wasHelpful !== undefined) {
        query = query.eq('was_helpful', filters.wasHelpful);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setFeedback(data || []);
      return { data: data || [], error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch feedback';
      setError(errorMessage);
      setFeedback([]);
      return { data: [], error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    feedback,
    loading,
    error,
    submitFeedback,
    fetchFeedback,
  };
};

