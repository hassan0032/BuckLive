export const useAdminEmailNotification = () => {
  const sendAdminCommunityEmail = async (
    communityId: string,
    communityName: string,
    managerId?: string | null
  ) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Missing Supabase env vars for admin email notification');
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/community-created-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          communityId,
          communityName,
          managerId,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Failed to trigger admin community email:', response.status, text);
      }
    } catch (err) {
      console.error('Unexpected error while sending admin community email:', err);
    }
  };

  return { sendAdminCommunityEmail };
};


