import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User as AppUser, REGISTRATION_TYPE, ROLE } from '../types';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isCommunityManager: boolean;
  isOrganizationManager: boolean;
  isMember: boolean;
  isSharedAccount: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOrgManager, setIsOrgManager] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  const invoiceGeneratedForUserRef = useRef<string | null>(null);

  // Check if user is in organization_managers table
  const checkOrgManager = async (userId: string) => {
    const { data, error } = await supabase
      .from('organization_managers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking org manager status:', error);
      return false;
    }
    return !!data;
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          // Skip if we already have this user's data
          if (currentUserIdRef.current === session.user.id) {
            console.log('⏭️ Skipping fetch - user data already loaded:', session.user.id);
            if (mounted) {
              setLoading(false);
            }
            return;
          }

          console.log('🔍 Fetching profile for user:', session.user.id);
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select(`
              *,
              community:communities!user_profiles_community_id_fkey(*)
            `)
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileError) {
            console.error('❌ Error fetching profile:', profileError);
          } else {
            console.log('✅ Profile data received:', profile);
            console.log('👤 User role from profile:', profile?.role);
          }

          if (!mounted) return;

          const appUser: AppUser = {
            id: session.user.id,
            email: session.user.email!,
            role: profile?.role || ROLE.MEMBER,
            created_at: session.user.created_at,
            community_id: profile?.community_id,
            registration_type: profile?.registration_type,
            stripe_customer_id: profile?.stripe_customer_id,
            subscription_id: profile?.subscription_id,
            subscription_status: profile?.subscription_status,
            subscription_started_at: profile?.subscription_started_at,
            subscription_ends_at: profile?.subscription_ends_at,
            is_shared_account: profile?.is_shared_account || false,
            needsPayment: !profile?.is_shared_account && profile?.role === ROLE.MEMBER && !profile?.subscription_id && profile?.registration_type === REGISTRATION_TYPE.SELF_REGISTERED,
            profile: {
              first_name: profile?.first_name || session.user.user_metadata?.first_name || '',
              last_name: profile?.last_name || session.user.user_metadata?.last_name || '',
              avatar_url: profile?.avatar_url || null,
              community: profile?.community || undefined,
            },
          };
          console.log('👥 Final appUser object:', appUser);
          console.log('🔑 Final role set to:', appUser.role);
          currentUserIdRef.current = session.user.id;
          setUser(appUser);

          // Check if user is an organization manager (by table membership, not role)
          const orgManagerStatus = await checkOrgManager(session.user.id);
          setIsOrgManager(orgManagerStatus);
          console.log('🏢 Organization manager status:', orgManagerStatus);
        } else {
          setUser(null);
          setIsOrgManager(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes - only one subscription for the entire app
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        (async () => {
          try {
            if (session?.user) {
              // Skip if we're already fetching or if user hasn't changed
              if (isFetchingRef.current) {
                console.log('⏭️ Already fetching profile, skipping duplicate call');
                return;
              }

              if (currentUserIdRef.current === session.user.id) {
                console.log('⏭️ User unchanged, skipping profile fetch:', session.user.id);
                return;
              }

              isFetchingRef.current = true;
              console.log('🔄 Auth state changed - Fetching profile for:', session.user.id);
              const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select(`
                  *,
                  community:communities!user_profiles_community_id_fkey(*)
                `)
                .eq('id', session.user.id)
                .maybeSingle();

              if (profileError) {
                console.error('❌ Error fetching profile in auth state change:', profileError);
              } else {
                console.log('✅ Profile data in auth state change:', profile);
                console.log('👤 User role in auth state change:', profile?.role);
              }

              if (!mounted) return;

              const appUser: AppUser = {
                id: session.user.id,
                email: session.user.email!,
                role: profile?.role || ROLE.MEMBER,
                created_at: session.user.created_at,
                community_id: profile?.community_id,
                registration_type: profile?.registration_type,
                stripe_customer_id: profile?.stripe_customer_id,
                subscription_id: profile?.subscription_id,
                subscription_status: profile?.subscription_status,
                subscription_started_at: profile?.subscription_started_at,
                subscription_ends_at: profile?.subscription_ends_at,
                is_shared_account: profile?.is_shared_account || false,
                needsPayment: !profile?.is_shared_account && profile?.role === ROLE.MEMBER && !profile?.subscription_id && profile?.registration_type === REGISTRATION_TYPE.SELF_REGISTERED,
                profile: {
                  first_name: profile?.first_name || session.user.user_metadata?.first_name || '',
                  last_name: profile?.last_name || session.user.user_metadata?.last_name || '',
                  avatar_url: profile?.avatar_url || null,
                  community: profile?.community || undefined,
                },
              };
              console.log('👥 Final appUser in auth state change:', appUser);
              console.log('🔑 Final role in auth state change:', appUser.role);
              currentUserIdRef.current = session.user.id;
              setUser(appUser);

              // Check if user is an organization manager (by table membership, not role)
              const orgManagerStatus = await checkOrgManager(session.user.id);
              setIsOrgManager(orgManagerStatus);
              console.log('🏢 Organization manager status:', orgManagerStatus);
            } else {
              if (mounted) {
                currentUserIdRef.current = null;
                setUser(null);
                setIsOrgManager(false);
                invoiceGeneratedForUserRef.current = null; // Reset when user logs out
              }
            }
          } catch (error) {
            console.error('Error in auth state change:', error);
            if (mounted) {
              setUser(null);
            }
          } finally {
            isFetchingRef.current = false;
          }
        })();
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAdmin: user?.role === ROLE.ADMIN,
    isCommunityManager: user?.role === ROLE.COMMUNITY_MANAGER,
    isOrganizationManager: user?.role === ROLE.ORGANIZATION_MANAGER || isOrgManager,
    isMember: user?.role === ROLE.MEMBER,
    isSharedAccount: user?.is_shared_account || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};