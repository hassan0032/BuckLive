export interface User {
  id: string;
  email: string;
  role: 'member' | 'admin';
  created_at: string;
  community_id?: string;
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
  duration?: number; // for videos in seconds
  file_size?: number; // for PDFs in bytes
}

export interface AuthState {
  user: User | null;
  loading: boolean;
}