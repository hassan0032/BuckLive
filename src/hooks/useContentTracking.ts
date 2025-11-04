import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useContentTracking = (contentId: string | undefined, userId: string | undefined, communityId: string | undefined, isAnonymous: boolean = false) => {
  const startTimeRef = useRef<number>(Date.now());
  const viewIdRef = useRef<string | null>(null);
  const isLoggingRef = useRef<boolean>(false);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Validate required parameters
    if (!contentId) return;
    if (!communityId) return;
    // For anonymous users, userId is null/undefined, which is allowed
    if (!isAnonymous && !userId) return;

    // Reset refs
    startTimeRef.current = Date.now();
    viewIdRef.current = null;
    isLoggingRef.current = false;
    lastUpdateRef.current = 0;

    const logView = async () => {
      if (isLoggingRef.current) return;
      isLoggingRef.current = true;

      try {
        console.log('Logging view:', { 
          contentId, 
          userId: isAnonymous ? null : userId, 
          communityId, 
          isAnonymous 
        });

        const { data, error } = await supabase
          .from('content_views')
          .insert([
            {
              user_id: isAnonymous ? null : userId,
              content_id: contentId,
              community_id: communityId,
              view_duration: 1,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error('Error logging content view:', error);
          isLoggingRef.current = false;
          return;
        }

        if (data) {
          viewIdRef.current = data.id;
          lastUpdateRef.current = 1;
          console.log('View logged successfully:', data.id);
        }
      } catch (err) {
        console.error('Error logging content view:', err);
        isLoggingRef.current = false;
      }
    };

    // Log view immediately
    logView();

    const updateViewDuration = async () => {
      if (!viewIdRef.current) return;

      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      // Only update if duration has changed
      if (duration <= lastUpdateRef.current) {
        return;
      }

      try {
        const { error } = await supabase
          .from('content_views')
          .update({ view_duration: duration })
          .eq('id', viewIdRef.current);

        if (error) {
          console.error('Error updating view duration:', error);
        } else {
          lastUpdateRef.current = duration;
          console.log('View duration updated successfully:', duration);
        }
      } catch (err) {
        console.error('Error updating view duration:', err);
      }
    };

    // Update more frequently (every 5 seconds) to catch short views
    const intervalId = setInterval(() => {
      if (viewIdRef.current) {
        updateViewDuration();
      }
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.hidden && viewIdRef.current) {
        updateViewDuration();
      }
    };

    const handleBeforeUnload = () => {
      if (viewIdRef.current) {
        // Use sendBeacon for more reliable tracking on page unload
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        
        try {
          // Attempt to update via fetch with keepalive
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/content_views?id=eq.${viewIdRef.current}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ view_duration: duration }),
            keepalive: true,
          }).catch(err => console.error('Error in beforeunload update:', err));
        } catch (err) {
          console.error('Error in beforeunload:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (viewIdRef.current) {
        updateViewDuration();
      }
    };
  }, [contentId, userId, communityId, isAnonymous]);
};