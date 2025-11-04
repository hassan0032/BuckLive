/**
 * Database Type Definitions
 * 
 * This file contains TypeScript type definitions that match the Supabase database schema.
 * Keep this file in sync with database migrations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      invoices: {
        Row: {
          id: string
          user_id: string | null
          invoice_no: number
          issue_date: string | null
          period_start: string
          period_end: string
          amount_cents: number
          currency: string
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string | null
          invoice_no?: number
          issue_date?: string | null
          period_start: string
          period_end: string
          amount_cents: number
          currency: string
          status: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          invoice_no?: number
          issue_date?: string | null
          period_start?: string
          period_end?: string
          amount_cents?: number
          currency?: string
          status?: string
          created_at?: string | null
        }
      }
      communities: {
        Row: {
          id: string
          name: string
          description: string | null
          access_code: string
          is_active: boolean
          is_sharable: boolean
          membership_tier: 'silver' | 'gold'
          is_sharable: boolean
          sharable_token: string | null
          created_at: string
          updated_at: string
          sharable_token: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          access_code: string
          is_active?: boolean
          is_sharable?: boolean
          membership_tier: 'silver' | 'gold'
          is_sharable?: boolean
          sharable_token?: string | null
          created_at?: string
          updated_at?: string
          sharable_token?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          access_code?: string
          is_active?: boolean
          is_sharable?: boolean
          membership_tier?: 'silver' | 'gold'
          is_sharable?: boolean
          sharable_token?: string | null
          created_at?: string
          updated_at?: string
          sharable_token?: string | null
        }
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          avatar_url: string
          role: 'member' | 'admin' | 'community_manager'
          community_id: string | null
          registration_type: 'access_code' | 'self_registered'
          stripe_customer_id: string | null
          subscription_id: string | null
          subscription_status: string | null
          payment_tier: 'silver' | 'gold' | null
          subscription_start_date: string | null
          subscription_end_date: string | null
          is_shared_account: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string
          last_name?: string
          avatar_url?: string
          role?: 'member' | 'admin' | 'community_manager'
          community_id?: string | null
          registration_type?: 'access_code' | 'self_registered'
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          payment_tier?: 'silver' | 'gold' | null
          subscription_start_date?: string | null
          subscription_end_date?: string | null
          is_shared_account?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          avatar_url?: string
          role?: 'member' | 'admin' | 'community_manager'
          community_id?: string | null
          registration_type?: 'access_code' | 'self_registered'
          stripe_customer_id?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          payment_tier?: 'silver' | 'gold' | null
          subscription_start_date?: string | null
          subscription_end_date?: string | null
          is_shared_account?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      community_managers: {
        Row: {
          id: string
          user_id: string
          community_id: string
          assigned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          community_id: string
          assigned_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          community_id?: string
          assigned_at?: string
        }
      }
      content: {
        Row: {
          id: string
          title: string
          description: string | null
          type: 'video' | 'pdf' | 'blog'
          url: string | null
          thumbnail_url: string | null
          tags: string[]
          category: string | null
          required_tier: 'silver' | 'gold'
          author: string
          duration: number | null
          file_size: number | null
          blog_content: string | null
          vimeo_video_id: string | null
          status: 'draft' | 'published'
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          type: 'video' | 'pdf' | 'blog'
          url?: string | null
          thumbnail_url?: string | null
          tags?: string[]
          category?: string | null
          required_tier?: 'silver' | 'gold'
          author: string
          duration?: number | null
          file_size?: number | null
          blog_content?: string | null
          vimeo_video_id?: string | null
          status?: 'draft' | 'published'
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          type?: 'video' | 'pdf' | 'blog'
          url?: string | null
          thumbnail_url?: string | null
          tags?: string[]
          category?: string | null
          required_tier?: 'silver' | 'gold'
          author?: string
          duration?: number | null
          file_size?: number | null
          blog_content?: string | null
          vimeo_video_id?: string | null
          status?: 'draft' | 'published'
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      content_versions: {
        Row: {
          id: string
          content_id: string
          version_number: number
          blog_content: string
          title: string
          description: string | null
          change_summary: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          content_id: string
          version_number: number
          blog_content: string
          title: string
          description?: string | null
          change_summary?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          content_id?: string
          version_number?: number
          blog_content?: string
          title?: string
          description?: string | null
          change_summary?: string | null
          created_by?: string
          created_at?: string
        }
      }
      content_views: {
        Row: {
          id: string
          user_id: string | null
          content_id: string
          view_duration: number | null
          viewed_at: string
          community_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          content_id: string
          view_duration?: number | null
          viewed_at?: string
          community_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          content_id?: string
          view_duration?: number | null
          viewed_at?: string
          community_id?: string | null
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          login_at: string
          logout_at: string | null
          session_duration: number | null
        }
        Insert: {
          id?: string
          user_id: string
          login_at?: string
          logout_at?: string | null
          session_duration?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          login_at?: string
          logout_at?: string | null
          session_duration?: number | null
        }
      }
      payments: {
        Row: {
          id: string
          user_id: string
          amount: number
          currency: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_invoice_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          currency?: string
          status: string
          stripe_payment_intent_id?: string | null
          stripe_invoice_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          currency?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_invoice_id?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      validate_access_code: {
        Args: {
          code: string
        }
        Returns: string | null
      }
      get_user_community_tier: {
        Args: {
          user_id: string
        }
        Returns: string
      }
      is_admin: {
        Args: {
          user_id: string
        }
        Returns: boolean
      }
      get_user_role: {
        Args: {
          user_id: string
        }
        Returns: string
      }
      validate_share_token: {
        Args: {
          token: string
        }
        Returns: Array<{
          community_id: string
          membership_tier: string
          name: string
        }>
      }
      set_share_token: {
        Args: {
          token: string
        }
        Returns: void
      }
      get_share_token_community_tier: {
        Args: Record<string, never>
        Returns: string
      }
      get_share_token_community_id: {
        Args: Record<string, never>
        Returns: string | null
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

