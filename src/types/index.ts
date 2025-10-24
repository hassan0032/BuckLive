export const Role = {
  MEMBER: 'member',
  ADMIN: 'admin',
  COMMUNITY_MANAGER: 'community_manager',
} as const;

export interface User {
  id: string;
  email: string;
  role: typeof Role[keyof typeof Role];
  created_at: string;
  community_id?: string;
  registration_type?: 'access_code' | 'self_registered';
  stripe_customer_id?: string;
  subscription_id?: string;
  subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  payment_tier?: 'silver' | 'gold';
  subscription_started_at?: string;
  subscription_ends_at?: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    community?: Community;
  };
}

export interface Community {
  id: string;
  name: string;
  description: string;
  access_code: string;
  is_active: boolean;
  membership_tier: 'silver' | 'gold';
  created_at: string;
  updated_at: string;
  created_by_manager_id?: string;
  member_count?: number;
}

export interface CommunityManager {
  id: string;
  user_id: string;
  community_id: string;
  created_at: string;
  created_by?: string;
}

export interface ContentView {
  id: string;
  user_id: string;
  content_id: string;
  view_duration: number;
  viewed_at: string;
  community_id?: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  login_at: string;
  logout_at?: string;
  session_duration?: number;
}

export interface Content {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'pdf' | 'blog';
  url: string;
  thumbnail_url?: string;
  tags: string[];
  category: string;
  required_tier: 'silver' | 'gold';
  created_at: string;
  updated_at: string;
  author: string;
  duration?: number;
  file_size?: number;
  blog_content?: string;
  blog_content_draft?: string;
  storage_thumbnail_path?: string;
  storage_pdf_path?: string;
  status?: 'draft' | 'published';
  vimeo_video_id?: string;
  published_at?: string;
}

export interface ContentVersion {
  id: string;
  content_id: string;
  version_number: number;
  blog_content: string;
  title: string;
  description: string;
  change_summary: string;
  created_by: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
}