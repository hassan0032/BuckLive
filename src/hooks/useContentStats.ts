import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ContentStats } from '../types';

export const useContentStats = (userId: string | undefined): ContentStats => {
  const [stats, setStats] = useState<ContentStats>({
    videosWatched: 0,
    articlesRead: 0,
    pdfsDownloaded: 0,
  });

  useEffect(() => {
    if (!userId) {
      setStats({
        videosWatched: 0,
        articlesRead: 0,
        pdfsDownloaded: 0,
      });
      return;
    }

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('content_views')
          .select(`
            content_id,
            content:content_id (
              type
            )
          `)
          .eq('user_id', userId);

        if (error) {
          console.error('Error fetching content stats:', error);
          return;
        }

        if (!data) return;

        // Count every view by content type (no deduping)
        const counts = { videosWatched: 0, articlesRead: 0, pdfsDownloaded: 0 };
        data.forEach((view) => {
          const content = view.content as { type?: string } | { type?: string }[] | null | undefined;
          const type = Array.isArray(content) ? content?.[0]?.type : content?.type;
          if (!type) return;
          if (type === 'video') counts.videosWatched++;
          else if (type === 'blog') counts.articlesRead++;
          else if (type === 'pdf') counts.pdfsDownloaded++;
        });

        setStats(counts);
      } catch (err) {
        console.error('Error fetching content stats:', err);
      }
    };

    fetchStats();
  }, [userId]);

  return stats;
};