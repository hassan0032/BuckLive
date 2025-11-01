import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useContentTracking = (contentId: string | undefined, userId: string | undefined, communityId: string | undefined, isAnonymous: boolean = false) => {
  const startTimeRef = useRef<number>(Date.now());
  const viewIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!contentId) return;
    // For anonymous users, userId is null/undefined, which is allowed
    if (!isAnonymous && !userId) return;

    startTimeRef.current = Date.now();

    const logView = async () => {
      try {
        const { data, error } = await supabase
          .from('content_views')
          .insert([
            {
              user_id: isAnonymous ? null : userId,
              content_id: contentId,
              community_id: communityId,
              view_duration: 0,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error('Error logging content view:', error);
        } else if (data) {
          viewIdRef.current = data.id;
        }
      } catch (err) {
        console.error('Error logging content view:', err);
      }
    };

    logView();

    const updateViewDuration = async () => {
      if (!viewIdRef.current) return;

      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      try {
        await supabase
          .from('content_views')
          .update({ view_duration: duration })
          .eq('id', viewIdRef.current);
      } catch (err) {
        console.error('Error updating view duration:', err);
      }
    };

    const intervalId = setInterval(updateViewDuration, 30000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateViewDuration();
      }
    };

    const handleBeforeUnload = () => {
      updateViewDuration();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updateViewDuration();
    };
  }, [contentId, userId, communityId, isAnonymous]);
};
