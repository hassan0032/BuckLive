import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROLE = {
  MEMBER: 'member',
  ADMIN: 'admin',
  COMMUNITY_MANAGER: 'community_manager',
  ORGANIZATION_MANAGER: 'organization_manager',
} as const;
type Role = typeof ROLE[keyof typeof ROLE];

interface CreateUserRequest {
  action: "create";
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  community_id?: string;
  role?: Role;
  is_shared_account?: boolean;
  managed_community_ids?: string[]; // Optional list of communities to manage if role is community_manager
}

interface DeleteUserRequest {
  action: "delete";
  user_id: string;
}

interface ResetPasswordRequest {
  action: "reset_password";
  user_id: string;
  new_password: string;
}

type UserManagementRequest = CreateUserRequest | DeleteUserRequest | ResetPasswordRequest;

interface CommunityData {
  id: string;
  organization_id: string | null;
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get Supabase credentials
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // @ts-ignore
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase clients
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const supabaseClient = createClient(
      supabaseUrl,
      // @ts-ignore
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify the caller's identity and role
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the caller's profile to check their role
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Could not verify caller permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerRole = callerProfile.role;

    // Parse request body
    const request: UserManagementRequest = await req.json();

    console.log(`📥 User management request: action=${request.action}, caller=${user.id}, role=${callerRole}`);

    // Route based on action
    switch (request.action) {
      case "create":
        return await handleCreateUser(request, supabaseAdmin, callerRole, user.id);
      case "delete":
        return await handleDeleteUser(request, supabaseAdmin, callerRole, user.id);
      case "reset_password":
        return await handleResetPassword(request, supabaseAdmin, callerRole, user.id);
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error: any) {
    console.error("Error in user-management edge function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleCreateUser(
  request: CreateUserRequest,
  supabaseAdmin: ReturnType<typeof createClient>,
  callerRole: Role,
  callerId: string
): Promise<Response> {
  const {
    email,
    password,
    first_name,
    last_name,
    community_id,
    role: requestedRole,
    is_shared_account,
    managed_community_ids
  } = request;

  // Validate required fields
  if (!email || !password || !first_name || !last_name) {
    return new Response(
      JSON.stringify({ error: "Email, password, first name, and last name are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(
      JSON.stringify({ error: "Invalid email format" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate password strength
  if (password.length < 6) {
    return new Response(
      JSON.stringify({ error: "Password must be at least 6 characters" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!requestedRole) {
    return new Response(
      JSON.stringify({ error: "Role is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let community: CommunityData | null = null;
  let communitiesToManage: string[] = [];

  if (requestedRole === ROLE.MEMBER) {
    if (!community_id) {
      return new Response(
        JSON.stringify({ error: "Community ID is required for members" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify community exists
    const { data: communityData, error: communityError } = await supabaseAdmin
      .from("communities")
      .select("id, organization_id")
      .eq("id", community_id)
      .single();

    community = communityData;

    if (communityError || !community) {
      return new Response(
        JSON.stringify({ error: "Community not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } else if (requestedRole === ROLE.COMMUNITY_MANAGER) {
    if (!managed_community_ids || managed_community_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one managed community ID is required for community managers" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure unique
    communitiesToManage = [...new Set(managed_community_ids)];
  }

  const { data: userProfile, error: userProfileError } = await supabaseAdmin
    .from("user_profiles")
    .select("role")
    .eq("id", callerId)
    .single();

  if (userProfileError || !userProfile) {
    return new Response(
      JSON.stringify({ error: "Could not verify caller permissions" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const isAdmin = userProfile.role === ROLE.ADMIN;
  const isOrgManager = userProfile.role === ROLE.ORGANIZATION_MANAGER;
  const isCommunityManager = userProfile.role === ROLE.COMMUNITY_MANAGER;
  const isMember = userProfile.role === ROLE.MEMBER;

  // Check if caller is an organization manager
  const { data: orgManager, error: orgManagerError } = await supabaseAdmin
    .from("organization_managers")
    .select("organization_id")
    .eq("user_id", callerId)
    .maybeSingle();

  // Validate role permissions
  if (!isMember) {
    if (!isAdmin) {
      let errorMessage: string | undefined;
      switch (requestedRole) {
        case ROLE.ADMIN:
          errorMessage = "Only admins can create admins";
          break;
        case ROLE.ORGANIZATION_MANAGER:
          errorMessage = "Only admins can create organization managers";
          break;
      }
      if (errorMessage) {
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Admins can create any role
    // Organization managers can create community_manager role for their org's communities
    if (!isAdmin && !isOrgManager) {
      if (requestedRole === ROLE.COMMUNITY_MANAGER) {
        return new Response(
          JSON.stringify({ error: "Only admins and organization managers can create users with community managers" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if organization manager has permission to create users in this community
    if (isOrgManager) {
      if (requestedRole === ROLE.MEMBER) {
        if (community?.organization_id !== orgManager.organization_id) {
          return new Response(
            JSON.stringify({ error: "You can only create users for communities in your organization" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else if (requestedRole === ROLE.COMMUNITY_MANAGER) {
        // Verify all managed communities belong to the organization
        const { data: communitiesCheck, error: communitiesCheckError } = await supabaseAdmin
          .from("communities")
          .select("id, organization_id")
          .in("id", communitiesToManage);

        if (communitiesCheckError || !communitiesCheck || communitiesCheck.length !== communitiesToManage.length) {
          return new Response(
            JSON.stringify({ error: "One or more managed communities not found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const allBelongToOrg = communitiesCheck.every((c: { organization_id: string }) => c.organization_id === orgManager.organization_id);
        if (!allBelongToOrg) {
          return new Response(
            JSON.stringify({ error: "You can only assign community managers to communities in your organization" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }
  }

  // Check if caller has permission to create users in this community
  if (isCommunityManager) {
    // Verify that the community manager manages this community
    const { data: managedCommunities, error: managerError } = await supabaseAdmin
      .from("community_managers")
      .select("community_id")
      .eq("user_id", callerId);

    if (managerError) {
      return new Response(
        JSON.stringify({ error: "Could not verify community manager permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const managesCommunity = managedCommunities?.some((cm: { community_id: string }) => cm.community_id === community_id);

    if (!managesCommunity) {
      return new Response(
        JSON.stringify({ error: "You do not manage this community" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check managed_community_ids permissions if provided?
    // Usually only Admins will use this via Admin Dashboard, but let's be safe.
    if (managed_community_ids && managed_community_ids.length > 0) {
      // Community Managers can't assign management of other communities
      return new Response(
        JSON.stringify({ error: "Community Managers cannot assign management rights to others" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  try {
    // Check for duplicate email
    const { data: existingUser, error: emailCheckError } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "A user with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    console.log(`Creating user: ${email} with role ${requestedRole} for community ${community_id}`);

    // Create the user with email confirmation enabled
    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: {
        first_name,
        last_name,
        role: requestedRole || ROLE.MEMBER,
        community_id: requestedRole === ROLE.MEMBER ? community_id : null,
        is_shared_account: is_shared_account || false,
      },
    });

    if (signUpError) {
      return new Response(
        JSON.stringify({ error: signUpError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user profile
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .update({
        role: requestedRole || ROLE.MEMBER,
        registration_type: "access_code",
        is_shared_account: is_shared_account || false,
      })
      .eq("id", authData.user.id);

    if (profileError) {
      console.error("❌ Profile update error:", profileError);
      // User is created but profile update failed - try to clean up
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: "Failed to create user profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Created user ${authData.user.id} with role ${requestedRole}`);

    // If creating a community manager, add to community_managers table
    if (requestedRole === ROLE.COMMUNITY_MANAGER) {
      const managerInserts = communitiesToManage.map((cid: string) => ({
        user_id: authData.user!.id,
        community_id: cid,
        created_by: callerId,
      }));

      const { error: managerError } = await supabaseAdmin
        .from("community_managers")
        .insert(managerInserts);

      if (managerError) {
        console.error("❌ Community manager assignment error:", managerError);
        // Try to clean up
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: "Failed to assign community manager" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        console.log(`✅ Assigned user ${authData.user.id} as community manager for community ${community_id}`);
      }
    }

    console.log(`✅ User creation completed successfully: ${authData.user.id}`);

    return new Response(
      JSON.stringify({
        data: {
          user: {
            id: authData.user.id,
            email: authData.user.email,
            role: requestedRole || ROLE.MEMBER,
            community_id: community_id,
          }
        },
        error: null
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleDeleteUser(
  request: DeleteUserRequest,
  supabaseAdmin: ReturnType<typeof createClient>,
  callerRole: Role,
  callerId: string
): Promise<Response> {
  const { user_id } = request;

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: "User ID is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: targetUser, error: userError } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .eq("id", user_id)
    .single();

  if (userError || !targetUser) {
    return new Response(
      JSON.stringify({ error: "User not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: userProfile, error: userProfileError } = await supabaseAdmin
    .from("user_profiles")
    .select("role")
    .eq("id", callerId)
    .single();

  if (userProfileError || !userProfile) {
    return new Response(
      JSON.stringify({ error: "Could not verify caller permissions" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const isAdmin = userProfile.role === ROLE.ADMIN;
  const isOrgManager = userProfile.role === ROLE.ORGANIZATION_MANAGER;
  const isCommunityManager = userProfile.role === ROLE.COMMUNITY_MANAGER;
  const isMember = userProfile.role === ROLE.MEMBER;

  if (isMember) {
    return new Response(
      JSON.stringify({ error: "You are not authorized to delete users" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (isCommunityManager) {
    if (targetUser.role !== ROLE.MEMBER) {
      return new Response(
        JSON.stringify({ error: "You can only delete members" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify that the community manager manages the user's community
    const { data: managedCommunities, error: managerError } = await supabaseAdmin
      .from("community_managers")
      .select("community_id")
      .eq("user_id", callerId);

    if (managerError) {
      return new Response(
        JSON.stringify({ error: "Could not verify community manager permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const managesMemberCommunity = managedCommunities?.some(cm => cm.community_id === targetUser.community_id);

    if (!managesMemberCommunity) {
      return new Response(
        JSON.stringify({ error: "You do not manage the user's community" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  if (isOrgManager) {
    if (targetUser.role !== ROLE.MEMBER && targetUser.role !== ROLE.COMMUNITY_MANAGER) {
      return new Response(
        JSON.stringify({ error: "You can only delete members and community managers" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify that the organization manager manages the user's community
    const { data: orgManager, error: orgManagerError } = await supabaseAdmin
      .from("organization_managers")
      .select("organization_id, organization:organizations(id)")
      .eq("user_id", userProfile.id)
      .single();

    if (orgManagerError || !orgManager) {
      return new Response(
        JSON.stringify({ error: "You are not an organization manager" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // An organization manager can delete a member only if the member is in a community in the organization that the manager manages.
    if (targetUser.role === ROLE.MEMBER) {
      const { data: memberCommunities, error: memberCommunitiesError } = await supabaseAdmin
        .from("communities")
        .select("id, organization_id")
        .eq("organization_id", orgManager.organization_id);

      if (memberCommunitiesError || !memberCommunities) {
        return new Response(
          JSON.stringify({ error: "Could not verify member communities" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const managesMemberCommunity = memberCommunities?.some(cm => cm.id === targetUser.community_id);
      if (!managesMemberCommunity) {
        return new Response(
          JSON.stringify({ error: "You do not manage the user's community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // An organization manager can delete a community manager only if the CM is the manager of a community in the organization.
    if (targetUser.role === ROLE.COMMUNITY_MANAGER) {
      const { data: targetUserManagedCommunities, error: targetUserManagerError } = await supabaseAdmin
        .from("community_managers")
        .select("community_id, community:communities(id, organization_id)")
        .eq("user_id", targetUser.id);

      if (targetUserManagerError) {
        return new Response(
          JSON.stringify({ error: "Could not verify community manager permissions" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const managesOrgCommunity = targetUserManagedCommunities?.some(cm => cm.community.organization_id === orgManager.organization_id);
      if (!managesOrgCommunity) {
        return new Response(
          JSON.stringify({ error: "You do not manage the user's community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
  }

  try {
    console.log(`Deleting user: ${user_id}`);
    // The database constraint (DELETE CASCADE) on community_managers table will handle cleanup of manager assignments.

    // Delete the user
    // This will cascade delete their profile and community_managers entries
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteError) {
      console.error("❌ Failed to delete user:", deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ User ${user_id} deleted successfully`);

    return new Response(
      JSON.stringify({ data: null, error: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleResetPassword(
  request: ResetPasswordRequest,
  supabaseAdmin: ReturnType<typeof createClient>,
  callerRole: Role,
  callerId: string
): Promise<Response> {
  const { user_id, new_password } = request;

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: "User ID is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!new_password || new_password.length < 6) {
    return new Response(
      JSON.stringify({ error: "Password must be at least 6 characters" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get target user
  const { data: targetUser, error: userError } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .eq("id", user_id)
    .single();

  if (userError || !targetUser) {
    return new Response(
      JSON.stringify({ error: "User not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get caller's profile
  const { data: userProfile, error: userProfileError } = await supabaseAdmin
    .from("user_profiles")
    .select("role")
    .eq("id", callerId)
    .single();

  if (userProfileError || !userProfile) {
    return new Response(
      JSON.stringify({ error: "Could not verify caller permissions" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const isAdmin = userProfile.role === ROLE.ADMIN;
  const isOrgManager = userProfile.role === ROLE.ORGANIZATION_MANAGER;
  const isCommunityManager = userProfile.role === ROLE.COMMUNITY_MANAGER;
  const isMember = userProfile.role === ROLE.MEMBER;

  // Members cannot reset passwords
  if (isMember) {
    return new Response(
      JSON.stringify({ error: "You are not authorized to reset passwords" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Community managers can only reset passwords for members in their managed communities
  if (isCommunityManager) {
    if (targetUser.role !== ROLE.MEMBER) {
      return new Response(
        JSON.stringify({ error: "You can only reset passwords for members" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify that the community manager manages the user's community
    const { data: managedCommunities, error: managerError } = await supabaseAdmin
      .from("community_managers")
      .select("community_id")
      .eq("user_id", callerId);

    if (managerError) {
      return new Response(
        JSON.stringify({ error: "Could not verify community manager permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const managesMemberCommunity = managedCommunities?.some((cm: { community_id: string }) => cm.community_id === targetUser.community_id);

    if (!managesMemberCommunity) {
      return new Response(
        JSON.stringify({ error: "You do not manage the user's community" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Organization managers can reset passwords for members and community managers in their org
  if (isOrgManager) {
    if (targetUser.role !== ROLE.MEMBER && targetUser.role !== ROLE.COMMUNITY_MANAGER) {
      return new Response(
        JSON.stringify({ error: "You can only reset passwords for members and community managers" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify that the organization manager manages the user's community/organization
    const { data: orgManager, error: orgManagerError } = await supabaseAdmin
      .from("organization_managers")
      .select("organization_id, organization:organizations(id)")
      .eq("user_id", userProfile.id)
      .single();

    if (orgManagerError || !orgManager) {
      return new Response(
        JSON.stringify({ error: "You are not an organization manager" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For members, verify they're in a community in the org
    if (targetUser.role === ROLE.MEMBER) {
      const { data: orgCommunities, error: orgCommunitiesError } = await supabaseAdmin
        .from("communities")
        .select("id, organization_id")
        .eq("organization_id", orgManager.organization_id);

      if (orgCommunitiesError || !orgCommunities) {
        return new Response(
          JSON.stringify({ error: "Could not verify member communities" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const managesMemberCommunity = orgCommunities?.some(cm => cm.id === targetUser.community_id);
      if (!managesMemberCommunity) {
        return new Response(
          JSON.stringify({ error: "You do not manage the user's community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // For community managers, verify they manage a community in the org
    if (targetUser.role === ROLE.COMMUNITY_MANAGER) {
      const { data: targetUserManagedCommunities, error: targetUserManagerError } = await supabaseAdmin
        .from("community_managers")
        .select("community_id, community:communities(id, organization_id)")
        .eq("user_id", targetUser.id);

      if (targetUserManagerError) {
        return new Response(
          JSON.stringify({ error: "Could not verify community manager permissions" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const managesOrgCommunity = targetUserManagedCommunities?.some(cm => cm.community.organization_id === orgManager.organization_id);
      if (!managesOrgCommunity) {
        return new Response(
          JSON.stringify({ error: "You do not manage the user's community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
  }

  try {
    console.log(`Resetting password for user: ${user_id}`);

    // Reset the password
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    );

    if (resetError) {
      console.error("❌ Failed to reset password:", resetError);
      return new Response(
        JSON.stringify({ error: resetError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Password reset successfully for user ${user_id}`);

    return new Response(
      JSON.stringify({ data: null, error: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
