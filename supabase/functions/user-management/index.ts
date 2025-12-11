import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserRequest {
  action: "create";
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  community_id: string;
  role?: "member" | "admin" | "community_manager";
  is_shared_account?: boolean;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
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
  } catch (error) {
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
  callerRole: string,
  callerId: string
): Promise<Response> {
  const { email, password, first_name, last_name, community_id, role: requestedRole, is_shared_account } = request;

  if (!community_id) {
    return new Response(
      JSON.stringify({ error: "Community ID is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify community exists
  const { data: community, error: communityError } = await supabaseAdmin
    .from("communities")
    .select("id, primary_manager, organization_id")
    .eq("id", community_id)
    .single();

  if (communityError || !community) {
    return new Response(
      JSON.stringify({ error: "Community not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!requestedRole) {
    return new Response(
      JSON.stringify({ error: "Role is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

  const isAdmin = userProfile.role === "admin";
  const isOrgManager = userProfile.role === "organization_manager";
  const isCommunityManager = userProfile.role === "community_manager";
  const isMember = userProfile.role === "member";

  // Check if caller is an organization manager
  const { data: orgManager, error: orgManagerError } = await supabaseAdmin
    .from("organization_managers")
    .select("organization_id")
    .eq("user_id", callerId)
    .maybeSingle();

  // Validate role permissions
  if (role && role !== "member") {
    // Only admins can create non-member roles
    if (callerRole !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can create users with admin or community_manager roles" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Check if caller has permission to create users in this community
  if (callerRole === "community_manager") {
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

    const managesCommunity = managedCommunities?.some(cm => cm.community_id === community_id);

    if (!managesCommunity) {
      return new Response(
        JSON.stringify({ error: "You do not manage this community" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Verify community exists
  const { data: community, error: communityError } = await supabaseAdmin
    .from("communities")
    .select("id")
    .eq("id", community_id)
    .single();

  if (communityError || !community) {
    return new Response(
      JSON.stringify({ error: "Community not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Create the user with email confirmation enabled
    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: {
        first_name,
        last_name,
        role: role || "member",
        community_id,
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
        role: role || "member",
        registration_type: "access_code",
        is_shared_account: is_shared_account || false,
      })
      .eq("id", authData.user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
      // User is created but profile update failed - this is a problem
      // We could attempt to roll back, but for now just log the error
    }

    // If creating a community manager, set their billing_date now if it's not already set.
    // This ensures admin-created/staff-created community managers get a billing anchor immediately
    // (only updates when billing_date IS NULL so it won't overwrite existing values).
    if (requestedRole === "community_manager") {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { error: billingUpdateError } = await supabaseAdmin
          .from('user_profiles')
          .update({ billing_date: today })
          .eq('id', authData.user.id)
          .is('billing_date', null);

        if (billingUpdateError) {
          console.error('Failed to set billing_date on created community manager:', billingUpdateError);
        } else {
          console.log(`Set billing_date=${today} for new community manager ${authData.user.id}`);
        }
      } catch (err) {
        console.error('Unexpected error setting billing_date for new community manager:', err);
      }
    }

    // If creating a community manager, add to community_managers table
    if (role === "community_manager") {
      const { error: managerError } = await supabaseAdmin
        .from("community_managers")
        .insert([
          {
            user_id: authData.user.id,
            community_id: community_id,
            created_by: callerId,
          },
        ]);

      if (managerError) {
        console.error("Community manager assignment error:", managerError);
      }
    }

    return new Response(
      JSON.stringify({ data: authData.user, error: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleDeleteUser(
  request: DeleteUserRequest,
  supabaseAdmin: ReturnType<typeof createClient>,
  callerRole: string,
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

  // if (!targetUser.community_id) {
  //   return new Response(
  //     JSON.stringify({ error: "Cannot delete users without a community" }),
  //     { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  //   );
  // }

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

  const isAdmin = userProfile.role === "admin";
  const isOrgManager = userProfile.role === "organization_manager";
  const isCommunityManager = userProfile.role === "community_manager";
  const isMember = userProfile.role === "member";

  if (isMember) {
    return new Response(
      JSON.stringify({ error: "You are not authorized to delete users" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (isCommunityManager) {
    if (targetUser.role !== "member") {
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
    if (targetUser.role !== "member" && targetUser.role !== "community_manager") {
      return new Response(
        JSON.stringify({ error: "You can only delete members and community managers" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify that the organization manager manages the user's community
    const { data: orgManager, error: orgManagerError } = await supabaseAdmin
      .from("organization_managers")
      .select("organization_id")
      .eq("user_id", userProfile.id)
      .maybeSingle();

    if (orgManagerError || !orgManager) {
      return new Response(
        JSON.stringify({ error: "You are not an organization manager" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: orgCommunities, error: orgCommunitiesError } = await supabaseAdmin
      .from("communities")
      .select("id, organization_id")
      .eq("organization_id", orgManager.organization_id);

    if (orgCommunitiesError || !orgCommunities) {
      return new Response(
        JSON.stringify({ error: "Could not verify organization communities" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const managesOrgCommunity = orgCommunities?.some(cm => cm.id === targetUser.organization_id);

    if (!managesOrgCommunity) {
      return new Response(
        JSON.stringify({ error: "You do not manage the user's organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (orgManager.organization_id !== targetUser.organization_id) {
      return new Response(
        JSON.stringify({ error: "You can only delete users from your organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller has permission to delete this user
    if (isCommunityManager) {
      // Verify that the community manager manages the user's community
      const { data: targetUser, error: userError } = await supabaseAdmin
        .from("user_profiles")
        .select("community_id")
        .eq("id", user_id)
        .single();

      if (userError || !targetUser) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!targetUser.community_id) {
        return new Response(
          JSON.stringify({ error: "Cannot delete users without a community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      const managesCommunity = managedCommunities?.some(cm => cm.community_id === targetUser.community_id);

      if (!managesCommunity) {
        return new Response(
          JSON.stringify({ error: "You do not manage the user's community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if organization manager has permission to delete this user
    if (isOrgManager && callerRole !== "admin") {
      // Verify the user belongs to a community in the org manager's organization
      const { data: targetUser, error: userError } = await supabaseAdmin
        .from("user_profiles")
        .select("community_id")
        .eq("id", user_id)
        .single();

      if (userError || !targetUser) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!targetUser.community_id) {
        return new Response(
          JSON.stringify({ error: "Cannot delete users without a community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the community belongs to the org manager's organization
      const { data: community, error: communityError } = await supabaseAdmin
        .from("communities")
        .select("organization_id")
        .eq("id", targetUser.community_id)
        .single();

      if (communityError || !community) {
        return new Response(
          JSON.stringify({ error: "Community not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (community.organization_id !== orgManager.organization_id) {
        return new Response(
          JSON.stringify({ error: "You can only delete users from communities in your organization" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    try {
      // Before deleting, check if this user is a primary_manager for any communities
      const { data: communitiesWithThisManager, error: communityFetchError } = await supabaseAdmin
        .from("communities")
        .select("id")
        .eq("primary_manager", user_id);

      if (communityFetchError) {
        console.error("Error fetching communities with primary manager:", communityFetchError);
      }

      // Delete the user
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // After deleting, update primary_manager for affected communities
      if (communitiesWithThisManager && communitiesWithThisManager.length > 0) {
        for (const community of communitiesWithThisManager) {
          // Find another manager for this community (not the deleted user)
          const { data: anotherManager, error: managerFetchError } = await supabaseAdmin
            .from("community_managers")
            .select("user_id")
            .eq("community_id", community.id)
            .neq("user_id", user_id)
            .limit(1)
            .maybeSingle();

          const newPrimaryManagerId = managerFetchError ? null : (anotherManager?.user_id || null);

          // Update the community's primary_manager
          const { error: updateError } = await supabaseAdmin
            .from("communities")
            .update({ primary_manager: newPrimaryManagerId })
            .eq("id", community.id);

          if (updateError) {
            console.error(`Failed to update primary_manager for community ${community.id}:`, updateError);
          } else {
            console.log(`Updated primary_manager for community ${community.id} to ${newPrimaryManagerId}`);
          }
        }
      }

      return new Response(
        JSON.stringify({ data: null, error: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  async function handleResetPassword(
    request: ResetPasswordRequest,
    supabaseAdmin: ReturnType<typeof createClient>,
    callerRole: string,
    callerId: string
  ): Promise<Response> {
    const { user_id, new_password } = request;

    // Check if caller is an organization manager
    const { data: orgManager, error: orgManagerError } = await supabaseAdmin
      .from("organization_managers")
      .select("organization_id")
      .eq("user_id", callerId)
      .maybeSingle();

    const isOrgManager = !orgManagerError && !!orgManager;

    // Check if caller has permission to reset this user's password
    if (callerRole === "community_manager" && !isOrgManager) {
      // Verify that the community manager manages the user's community
      const { data: targetUser, error: userError } = await supabaseAdmin
        .from("user_profiles")
        .select("community_id")
        .eq("id", user_id)
        .single();

      if (userError || !targetUser) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!targetUser.community_id) {
        return new Response(
          JSON.stringify({ error: "Cannot reset password for users without a community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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

      const managesCommunity = managedCommunities?.some(cm => cm.community_id === targetUser.community_id);

      if (!managesCommunity) {
        return new Response(
          JSON.stringify({ error: "You do not manage the user's community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if organization manager has permission to reset this user's password
    if (isOrgManager && callerRole !== "admin") {
      // Verify the user belongs to a community in the org manager's organization
      const { data: targetUser, error: userError } = await supabaseAdmin
        .from("user_profiles")
        .select("community_id")
        .eq("id", user_id)
        .single();

      if (userError || !targetUser) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!targetUser.community_id) {
        return new Response(
          JSON.stringify({ error: "Cannot reset password for users without a community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the community belongs to the org manager's organization
      const { data: community, error: communityError } = await supabaseAdmin
        .from("communities")
        .select("organization_id")
        .eq("id", targetUser.community_id)
        .single();

      if (communityError || !community) {
        return new Response(
          JSON.stringify({ error: "Community not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (community.organization_id !== orgManager.organization_id) {
        return new Response(
          JSON.stringify({ error: "You can only reset passwords for users in communities in your organization" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    try {
      // Reset the password
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { password: new_password }
      );

      if (resetError) {
        return new Response(
          JSON.stringify({ error: resetError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ data: null, error: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
}