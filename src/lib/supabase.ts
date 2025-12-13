import { createClient, PostgrestError } from '@supabase/supabase-js';
import { ROLE } from '../types';

// Function to create Supabase client with proper error handling
const createSupabaseClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing environment variables:');
    console.error('  URL:', supabaseUrl);
    console.error('  Key:', supabaseAnonKey);
    throw new Error('Missing Supabase environment variables');
  }

  console.log('✅ Environment variables loaded successfully');

  try {
    console.log('🔍 Creating Supabase client with:');
    console.log('  URL:', supabaseUrl);
    console.log('  Key (first 20 chars):', supabaseAnonKey?.substring(0, 20) + '...');

    const client = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase client created successfully');
    return client;
  } catch (error) {
    console.error('❌ Error creating Supabase client:', error);
    console.error('❌ Error details:', error);
    throw error;
  }
};

export const supabase = createSupabaseClient();

export interface ValidateAccessCodeResponse {
  communityId: string | null;
  isAdmin: boolean;
}

export const validateAccessCode = async (accessCode: string) => {
  const { data, error } = await supabase.rpc('validate_access_code', { p_code: accessCode });
  if (!data) {
    return { data: null as ValidateAccessCodeResponse | null, error };
  }

  return {
    data: {
      communityId: data.community_id ?? null,
      isAdmin: Boolean(data.is_admin),
    },
    error,
  };
};

export const signUp = async (email: string, password: string, firstName: string, lastName: string, communityId: string | null, is_admin?: boolean) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: is_admin ? ROLE.ADMIN : ROLE.MEMBER,
        community_id: communityId,
      },
    },
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!error && data?.user) {
    // Record login time in user_sessions
    const { error: insertError } = await supabase.from('user_sessions').insert({
      user_id: data.user.id, // FK to user_profiles.id
      login_at: new Date().toISOString(),
    });
    if (insertError) {
      console.error('❌ Failed to insert login session:', insertError);
    } else {
      console.log('✅ Login session recorded for:', data.user.id);
    }
  }

  return { data, error };
};

export const signOut = async () => {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Find the most recent open session (logout_at = null)
    const { data: openSessions, error: fetchError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .is('logout_at', null)
      .order('login_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching open session:', fetchError);
    } else if (openSessions && openSessions.length > 0) {
      const session = openSessions[0];
      const logoutTime = new Date();
      const loginTime = new Date(session.login_at);
      const durationMs = logoutTime.getTime() - loginTime.getTime();
      const durationMinutes = Math.round(durationMs / 1000 / 60); // duration in minutes

      // Update logout_at and session_duration
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({
          logout_at: logoutTime.toISOString(),
          session_duration: durationMinutes,
        })
        .eq('id', session.id);

      if (updateError) {
        console.error('Failed to update session logout:', updateError);
      } else {
        console.log(`Session closed for ${user.id} (${durationMinutes} minutes)`);
      }
    }
  }

  const { error } = await supabase.auth.signOut();
  return { error };
};


export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const resetPassword = async (email: string) => {
  try {
    // Call the password-reset edge function
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { data: null, error: { message: result.error || 'Failed to send password reset email' } };
    }

    if (result.error) {
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Failed to send password reset email' } };
  }
};

export const updatePassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
};

// Admin function to reset user password
export const adminResetUserPassword = async (userId: string, newPassword: string) => {
  try {
    // Get the current session to pass auth header
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return { data: null, error: { message: 'Not authenticated' } };
    }

    // Call the edge function
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-management`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'reset_password',
        user_id: userId,
        new_password: newPassword,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { data: null, error: { message: result.error || 'Failed to reset password' } };
    }

    if (result.error) {
      return { data: null, error: { message: result.error } };
    }

    return { data: result.data, error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Failed to reset password' } };
  }
};

// Helper function to get thumbnail URL from content
export const getThumbnailUrl = (content: { thumbnail_url?: string; storage_thumbnail_path?: string }): string => {
  // If thumbnail_url is set, use it
  if (content.thumbnail_url) {
    return content.thumbnail_url;
  }

  // Otherwise, generate public URL from storage path
  if (content.storage_thumbnail_path) {
    const { data } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(content.storage_thumbnail_path);
    return data.publicUrl;
  }

  return '';
};

// Helper function to get PDF URL from content
export const getPDFUrl = (content: { url?: string; storage_pdf_path?: string }): string => {
  // If url is set, use it
  if (content.url) {
    return content.url;
  }

  // Otherwise, generate public URL from storage path
  if (content.storage_pdf_path) {
    const { data } = supabase.storage
      .from('pdfs')
      .getPublicUrl(content.storage_pdf_path);
    return data.publicUrl;
  }

  return '';
};

// End of file
