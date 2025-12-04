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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    // Get the currently authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = user.id;

    // Parse request body (optional - for manual invoice creation)
    let requestBody: any = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        requestBody = JSON.parse(bodyText);
      }
    } catch (e) {
      // Empty body is fine for automatic generation
    }

    // If invoice data is provided, handle manual invoice creation
    if (requestBody.community_id && requestBody.issue_date && requestBody.period_start &&
      requestBody.period_end && requestBody.amount_cents !== undefined &&
      requestBody.currency && requestBody.status) {

      console.log("🔍 Manual invoice creation requested for community:", requestBody.community_id);

      // Verify user has permission to create invoice for this community
      const { data: userProfile, error: profileError } = await supabaseClient
        .from("user_profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profileError || !userProfile) {
        return new Response(
          JSON.stringify({ error: "Failed to verify user permissions" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const isAdmin = userProfile.role === "admin";

      // If not admin, check if user is a community manager for this community
      if (!isAdmin) {
        const { data: managerCheck, error: managerError } = await supabaseClient
          .from("community_managers")
          .select("community_id")
          .eq("user_id", userId)
          .eq("community_id", requestBody.community_id)
          .maybeSingle();

        if (managerError || !managerCheck) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: You do not have permission to create invoices for this community" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      // Check if invoice already exists for this community and period
      const { data: existingInvoice, error: checkError } = await supabaseClient
        .from("invoices")
        .select("id")
        .eq("community_id", requestBody.community_id)
        .eq("period_start", requestBody.period_start)
        .eq("period_end", requestBody.period_end)
        .maybeSingle();

      if (checkError) {
        console.error("❌ Error checking existing invoice:", checkError);
        return new Response(
          JSON.stringify({ error: "Failed to check existing invoices" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (existingInvoice) {
        return new Response(
          JSON.stringify({
            message: "Invoice already exists for this community and period",
            data: existingInvoice,
            created: 0
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Verify community exists and check if primary_manager is already set
      const { data: community, error: communityError } = await supabaseClient
        .from("communities")
        .select("id, primary_manager")
        .eq("id", requestBody.community_id)
        .single();

      if (communityError || !community) {
        return new Response(
          JSON.stringify({ error: "Community not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // If no primary manager is set, pick any manager of this community
      if (!community.primary_manager) {
        // Get any manager for this community
        const { data: anyManager, error: managerFetchError } = await supabaseClient
          .from("community_managers")
          .select("user_id")
          .eq("community_id", requestBody.community_id)
          .limit(1)
          .maybeSingle();

        const primaryManagerId = managerFetchError ? null : (anyManager?.user_id || null);

        const { error: updateError } = await supabaseClient
          .from("communities")
          .update({ primary_manager: primaryManagerId })
          .eq("id", requestBody.community_id);

        if (updateError) {
          console.error("⚠️ Failed to set primary manager:", updateError);
          // Don't fail the entire request, just log the error
        } else {
          console.log(`✅ Set user ${primaryManagerId} as primary manager for community ${requestBody.community_id}`);
        }
      }

      // Calculate discount percentage for manual invoice creation
      // Get all communities managed by this user to determine rank
      const { data: allManagerCommunities, error: allCmError } = await supabaseClient
        .from("community_managers")
        .select("community_id, communities:community_id(created_at)")
        .eq("user_id", userId);

      let discountPercentage = 0;
      if (!allCmError && allManagerCommunities?.length) {
        const allCommunityMeta = allManagerCommunities.map((row: any) => {
          const community = Array.isArray(row.communities)
            ? row.communities[0]
            : row.communities;
          return {
            communityId: row.community_id,
            createdAt: community?.created_at || new Date().toISOString(),
          };
        });

        // Sort by created_at
        allCommunityMeta.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // Find rank of the community for this invoice
        const rank = allCommunityMeta.findIndex(c => c.communityId === requestBody.community_id);

        // Helper function to calculate discount percentage based on rank
        const getDiscountPercentage = (rank: number): number => {
          const newTotal = rank + 1;
          if (newTotal >= 20) return 40;
          if (newTotal >= 10) return 36;
          if (newTotal >= 6) return 30;
          switch (newTotal) {
            case 5: return 20;
            case 4: return 15;
            case 3: return 10;
            case 2: return 5;
            default: return 0;
          }
        };

        discountPercentage = rank >= 0 ? getDiscountPercentage(rank) : 0;
      }

      // Create invoice
      const { data: inserted, error: insertError } = await supabaseClient
        .from("invoices")
        .insert([
          {
            community_id: requestBody.community_id,
            issue_date: requestBody.issue_date,
            period_start: requestBody.period_start,
            period_end: requestBody.period_end,
            amount_cents: requestBody.amount_cents,
            currency: requestBody.currency,
            status: requestBody.status,
            discount_percentage: discountPercentage,
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("❌ Failed to create invoice:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create invoice", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      console.log(`✅ Created invoice #${inserted.invoice_no} for community ${requestBody.community_id}`);

      return new Response(
        JSON.stringify({
          message: "Invoice created successfully",
          data: inserted,
          created: 1,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Otherwise, handle automatic first invoice generation
    console.log("🔍 Ensuring first invoices for user:", userId);

    // 1. Get communities managed by this user, ordered by created_at
    const { data: managerCommunities, error: cmError } = await supabaseClient
      .from("community_managers")
      .select("community_id, communities:community_id(name, membership_tier, created_at, primary_manager)")
      .eq("user_id", userId);

    if (cmError) {
      console.error("❌ Error loading communities:", cmError);
      return new Response(
        JSON.stringify({ error: "Failed to load managed communities" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!managerCommunities?.length) {
      console.log("ℹ No managed communities found.");
      return new Response(
        JSON.stringify({ message: "No managed communities for this user", created: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const communityMeta = managerCommunities.map((row: any) => {
      const community = Array.isArray(row.communities)
        ? row.communities[0]
        : row.communities;

      return {
        communityId: row.community_id,
        communityTier: (community?.membership_tier ?? "silver") as string,
        createdAt: community?.created_at || new Date().toISOString(),
        primaryManager: community?.primary_manager || null,
      };
    });

    // Sort communities by created_at to generate invoices in order
    communityMeta.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const communityIds = communityMeta.map((c) => c.communityId);
    const today = new Date().toISOString().slice(0, 10);
    const todayDate = new Date(today);

    // 2. Fetch ALL invoices for these communities (past and current)
    const { data: allInvoices, error: invoiceFetchError } = await supabaseClient
      .from("invoices")
      .select("*")
      .in("community_id", communityIds)
      .order("period_end", { ascending: false });

    if (invoiceFetchError) {
      console.error("❌ Error fetching invoices:", invoiceFetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Separate valid (current/future) invoices from past invoices
    const validInvoiceCommunities = new Set(
      allInvoices
        ?.filter((inv: any) => new Date(inv.period_end) >= todayDate)
        .map((inv: any) => inv.community_id) ?? [],
    );

    // 3. Prepare invoices to insert (only for communities without valid invoices)
    // Communities are already sorted by created_at
    const nextYear = new Date(todayDate);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const endDateISO = nextYear.toISOString().slice(0, 10);

    const communitiesNeedingInvoices = communityMeta
      .filter((meta) => !validInvoiceCommunities.has(meta.communityId));

    if (!communitiesNeedingInvoices.length) {
      console.log("✔ All communities already have valid invoices.");
      return new Response(
        JSON.stringify({ message: "All communities already have valid invoices", created: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Helper function to calculate discount percentage based on rank
    const getDiscountPercentage = (rank: number): number => {
      const newTotal = rank + 1; // rank 0 = 1st community, rank 1 = 2nd community, etc.

      if (newTotal >= 20) return 40;
      if (newTotal >= 10) return 36;
      if (newTotal >= 6) return 30;

      switch (newTotal) {
        case 5: return 20;
        case 4: return 15;
        case 3: return 10;
        case 2: return 5;
        default: return 0;
      }
    };

    // Create invoices in order (communities already sorted by created_at)
    // Calculate discount percentage based on rank (order of creation)
    // Rank is based on position in the FULL sorted list (all communities, not just those needing invoices)
    const invoicesToInsert = communitiesNeedingInvoices.map((meta) => {
      // Find the rank of this community among ALL communities (including those with existing invoices)
      // Rank is based on position in the sorted communityMeta list
      const rank = communityMeta.findIndex(c => c.communityId === meta.communityId);
      const discountPercentage = getDiscountPercentage(rank);

      const baseAmountCents = meta.communityTier.toLowerCase() === "gold" ? 500000 : 250000;

      return {
        community_id: meta.communityId,
        issue_date: today,
        period_start: today,
        period_end: endDateISO,
        amount_cents: baseAmountCents,
        currency: "USD",
        status: "issued",
        discount_percentage: discountPercentage,
      };
    });

    const { data: inserted, error: insertError } = await supabaseClient
      .from("invoices")
      .insert(invoicesToInsert)
      .select();

    if (insertError) {
      console.error("❌ Failed to create invoices:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Set primary manager for communities that don't have one
    const communitiesWithoutPrimaryManager = communitiesNeedingInvoices
      .filter((meta: { primaryManager: string | null }) => !meta.primaryManager)
      .map((meta: { communityId: string }) => meta.communityId);

    if (communitiesWithoutPrimaryManager.length > 0) {
      // For each community without a primary manager, pick any manager
      for (const communityId of communitiesWithoutPrimaryManager) {
        // Get any manager for this community
        const { data: anyManager, error: managerFetchError } = await supabaseClient
          .from("community_managers")
          .select("user_id")
          .eq("community_id", communityId)
          .limit(1)
          .maybeSingle();

        const primaryManagerId = managerFetchError ? null : (anyManager?.user_id || null);

        const { error: updateError } = await supabaseClient
          .from("communities")
          .update({ primary_manager: primaryManagerId })
          .eq("id", communityId);

        if (updateError) {
          console.error(`⚠️ Failed to set primary manager for community ${communityId}:`, updateError);
        } else {
          console.log(`✅ Set user ${primaryManagerId} as primary manager for community ${communityId}`);
        }
      }
    }

    console.log(
      `✅ Created ${inserted?.length ?? 0} first invoice(s) for period ${today} to ${endDateISO}`,
    );

    return new Response(
      JSON.stringify({
        message: "First invoices generated successfully",
        created: inserted?.length ?? 0,
        data: inserted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("🔥 Error in create-first-invoice function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


