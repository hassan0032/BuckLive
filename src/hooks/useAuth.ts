import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User as AppUser, REGISTRATION_TYPE, ROLE } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
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
            payment_tier: profile?.payment_tier,
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
          setUser(appUser);
        } else {
          setUser(null);
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        (async () => {
          try {
            if (session?.user) {
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
                payment_tier: profile?.payment_tier,
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
              setUser(appUser);
            } else {
              if (mounted) {
                setUser(null);
              }
            }
          } catch (error) {
            console.error('Error in auth state change:', error);
            if (mounted) {
              setUser(null);
            }
          }
        })();
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
    isAdmin: user?.role === 'admin',
    isCommunityManager: user?.role === 'community_manager',
    isSharedAccount: user?.is_shared_account || false,
  };
};