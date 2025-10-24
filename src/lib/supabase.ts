import { createClient, PostgrestError } from '@supabase/supabase-js';
import { Role } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ValidateAccessCodeResponse {
  communityId: string;
  is_admin: boolean;
}

export const validateAccessCode = async (accessCode: string) => {
  const { data, error }: { data: ValidateAccessCodeResponse | null; error: PostgrestError | null } = await supabase.rpc('validate_access_code', { code: accessCode });
  return { data, error };
};

export const signUp = async (email: string, password: string, firstName: string, lastName: string, communityId: string | null, is_admin?: boolean) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: is_admin ? Role.ADMIN : Role.MEMBER,
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
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { data, error };
};

export const updatePassword = async (newPassword: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
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