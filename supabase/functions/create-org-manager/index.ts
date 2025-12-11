import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin
    const { data: requestingProfile, error: profileError } = await userClient
      .from("user_profiles")
      .select("role")
      .eq("id", requestingUser.id)
      .single();

    if (profileError || requestingProfile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can create organization managers" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { organizationName, email, firstName, lastName, password } = body;

    if (!organizationName || !email || !firstName || !lastName || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: organizationName, email, firstName, lastName, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email already exists
    const { data: existingUser } = await adminClient
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

    // Step 1: Create the new user
    const { data: authData, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createUserError || !authData.user) {
      console.error("Error creating user:", createUserError);
      return new Response(
        JSON.stringify({ error: createUserError?.message || "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = authData.user.id;
    console.log(`✅ Created user: ${newUserId}`);

    // Step 2: Create user profile (trigger should handle this, but let's ensure it exists)
    const { error: profileInsertError } = await adminClient
      .from("user_profiles")
      .upsert({
        id: newUserId,
        email,
        first_name: firstName,
        last_name: lastName,
        role: "organization_manager",
      });

    if (profileInsertError) {
      console.error("Error creating profile:", profileInsertError);
      // Don't fail - the trigger might have already created it
    }

    // Step 3: Create the organization
    const today = new Date().toISOString().split("T")[0];
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .insert([{ name: organizationName, billing_date: today }])
      .select()
      .single();

    if (orgError) {
      console.error("Error creating organization:", orgError);
      // Try to clean up the user we created
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: "Failed to create organization" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Created organization: ${org.id}`);

    // Step 4: Create the organization manager assignment
    const { error: assignError } = await adminClient
      .from("organization_managers")
      .insert({
        organization_id: org.id,
        user_id: newUserId,
      });

    if (assignError) {
      console.error("Error assigning manager:", assignError);
      // Try to clean up
      await adminClient.from("organizations").delete().eq("id", org.id);
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: "Failed to assign organization manager" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Assigned user ${newUserId} as manager of organization ${org.id}`);

    return new Response(
      JSON.stringify({
        message: "Organization manager created successfully",
        data: {
          organization: org,
          user: {
            id: newUserId,
            email,
            firstName,
            lastName,
          },
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("🔥 Error in create-org-manager function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

