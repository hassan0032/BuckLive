export const ROLE = {
  MEMBER: 'member',
  ADMIN: 'admin',
  COMMUNITY_MANAGER: 'community_manager',
} as const;
export type Role = typeof ROLE[keyof typeof ROLE];

export const REGISTRATION_TYPE = {
  ACCESS_CODE: 'access_code',
  SELF_REGISTERED: 'self_registered',
} as const;
export type RegistrationType = typeof REGISTRATION_TYPE[keyof typeof REGISTRATION_TYPE];

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  TRIALING: 'trialing',
  INCOMPLETE: 'incomplete',
} as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];

export const PAYMENT_TIER = {
  SILVER: 'silver',
  GOLD: 'gold',
} as const;
export type PaymentTier = typeof PAYMENT_TIER[keyof typeof PAYMENT_TIER];

export const CONTENT_TYPE = {
  VIDEO: 'video',
  PDF: 'pdf',
  BLOG: 'blog',
} as const;
export type ContentType = typeof CONTENT_TYPE[keyof typeof CONTENT_TYPE];

export const CONTENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;
export type ContentStatus = typeof CONTENT_STATUS[keyof typeof CONTENT_STATUS];

export interface User {
  id: string;
  email: string;
  role: Role;
  created_at: string;
  community_id?: string;
  registration_type?: RegistrationType;
  stripe_customer_id?: string;
  subscription_id?: string;
  subscription_status?: SubscriptionStatus;
  payment_tier?: PaymentTier;
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
  membership_tier: PaymentTier;
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
  type: ContentType;
  url: string;
  thumbnail_url?: string;
  tags: string[];
  category: string;
  required_tier: PaymentTier;
  created_at: string;
  updated_at: string;
  author: string;
  duration?: number;
  file_size?: number;
  blog_content?: string;
  blog_content_draft?: string;
  storage_thumbnail_path?: string;
  storage_pdf_path?: string;
  status?: ContentStatus;
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