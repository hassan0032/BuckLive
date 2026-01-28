import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ContentQuestion } from '../types';

export interface QuestionFilters {
  contentId?: string;
  startDate?: string;
  endDate?: string;
}

export const useContentQuestions = () => {
  const [questions, setQuestions] = useState<ContentQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitQuestion = async (questionData: {
    content_id: string;
    name: string;
    email?: string | null;
    question: string;
    content_title?: string;
  }) => {
    try {
      setError(null);
      
      // Insert question into database
      const { data, error: insertError } = await supabase
        .from('content_questions')
        .insert([{
          content_id: questionData.content_id,
          name: questionData.name,
          email: questionData.email || null,
          question: questionData.question,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Send email notification
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseAnonKey) {
          const response = await fetch(`${supabaseUrl}/functions/v1/content-question-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              name: questionData.name,
              email: questionData.email || 'Anonymous',
              question: questionData.question,
              content_title: questionData.content_title || 'Unknown Content',
              content_id: questionData.content_id,
            }),
          });

          if (!response.ok) {
            console.error('Failed to send email notification:', await response.text());
            // Don't fail the submission if email fails
          }
        }
      } catch (emailError) {
        console.error('Email notification error:', emailError);
        // Don't fail the submission if email fails
      }

      return { data, error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit question';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    }
  };

  const fetchQuestions = async (filters?: QuestionFilters) => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('content_questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.contentId) {
        query = query.eq('content_id', filters.contentId);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setQuestions(data || []);
      return { data: data || [], error: null };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch questions';
      setError(errorMessage);
      setQuestions([]);
      return { data: [], error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    questions,
    loading,
    error,
    submitQuestion,
    fetchQuestions,
  };
};
