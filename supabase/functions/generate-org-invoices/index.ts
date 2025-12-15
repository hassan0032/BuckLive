import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Helper function to calculate discount percentage based on community count
function getDiscountPercentage(communityCount: number): number {
  if (communityCount >= 20) return 40;
  if (communityCount >= 10) return 36;
  if (communityCount >= 6) return 30;
  switch (communityCount) {
    case 5: return 20;
    case 4: return 15;
    case 3: return 10;
    case 2: return 5;
    default: return 0;
  }
}

function formatYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addYears(ymd: string, years: number) {
  const date = new Date(ymd);
  date.setFullYear(date.getFullYear() + years);
  return formatYMD(date);
}

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

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Use service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const todayYMD = formatYMD(today);
    console.log(`Running org community invoice generator for ${todayYMD}`);

    // Step 1: Find all communities that belong to an organization
    const { data: orgCommunities, error: communityError } = await supabase
      .from("communities")
      .select(`
        id,
        name,
        code,
        membership_tier,
        organization_id,
        organizations:organization_id (
          id,
          name
        )
      `)
      .not("organization_id", "is", null);

    if (communityError) {
      console.error("Error fetching org communities:", communityError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch communities" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!orgCommunities || orgCommunities.length === 0) {
      console.log("No organization communities found.");
      return new Response(
        JSON.stringify({ message: "No organization communities found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${orgCommunities.length} communities belonging to organizations.`);

    // Get all community IDs
    const communityIds = orgCommunities.map((c: any) => c.id);

    // Step 2: Fetch MOST RECENT existing invoice for each community (to determine next period start)
    // We only care about the latest one per community
    const { data: latestInvoices, error: invoiceError } = await supabase
      .from("invoices")
      .select("community_id, period_end")
      .in("community_id", communityIds)
      .order("period_end", { ascending: false });

    if (invoiceError) {
      console.error("Error fetching existing invoices:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map community_id -> latest period_end
    const latestInvoiceMap = new Map<string, string>();
    if (latestInvoices) {
      for (const inv of latestInvoices) {
        if (!latestInvoiceMap.has(inv.community_id)) {
          latestInvoiceMap.set(inv.community_id, inv.period_end);
        }
      }
    }

    // Step 3: Filter communities that need invoices
    // A community needs an invoice if:
    // 1. It has no invoices yet (new community)
    // 2. Its latest invoice's period_end is <= 30 days from now (upcoming renewal) OR already passed
    const communitiesNeedingInvoices: any[] = [];

    // We'll define a renewal window, e.g., generate invoice 30 days before expiry
    const renewalHorizonDate = new Date(today);
    renewalHorizonDate.setDate(renewalHorizonDate.getDate() + 30);
    const renewalHorizonYMD = formatYMD(renewalHorizonDate);

    for (const community of orgCommunities) {
      const lastPeriodEnd = latestInvoiceMap.get(community.id);

      if (!lastPeriodEnd) {
        // Case 1: No previous invoice -> generate one starting today
        communitiesNeedingInvoices.push({ ...community, nextPeriodStart: todayYMD });
      } else {
        // Case 2: Has previous invoice -> check if it's time to renew
        // If the current period ends before or within our renewal horizon
        if (lastPeriodEnd <= renewalHorizonYMD) {
          // The next period starts the day after the last period ended? 
          // Or just align to the anniversary logic. 
          // Usually: start = last_end (as Supabase usually stores inclusive/exclusive ranges might vary, 
          // but let's assume period_end is the last covered day).
          // Let's set next start date = last period end + 1 day?
          // Or strictly follow the cycle. 
          // For simplicity/safety: nextPeriodStart = lastPeriodEnd (if the system treats ends as exclusive) 
          // OR period_end is inclusive, so start = period_end (if we want seamless).
          // Let's assume period_end is the last day of coverage. So next start is +1 day.
          // However, for simplicity here, I'll set nextPeriodStart = lastPeriodEnd if it's in the past,
          // or just ensure continuity.
          // Actually, let's keep it simple: nextPeriodStart = lastPeriodEnd.
          // (Assuming the previous invoice covered up to that date).

          // To be safe and avoid gaps, let's look at how the dates were generated before.
          // Before: period_end was a specific date.
          // Let's assume start = last_end.
          communitiesNeedingInvoices.push({ ...community, nextPeriodStart: lastPeriodEnd });
        }
      }
    }

    if (communitiesNeedingInvoices.length === 0) {
      console.log("All organization communities have valid future invoices.");
      return new Response(
        JSON.stringify({ message: "All organization communities have valid future invoices", created: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${communitiesNeedingInvoices.length} communities need invoices.`);

    // Step 4: Group by organization to calculate discounts
    const orgMap = new Map<string, any[]>();
    for (const community of communitiesNeedingInvoices) {
      const orgId = community.organization_id;
      if (!orgMap.has(orgId)) {
        orgMap.set(orgId, []);
      }
      orgMap.get(orgId)!.push(community);
    }

    // Step 5: For each organization, count TOTAL communities (including those not needing invoices)
    // to determine the discount tier
    const orgCommunityCountMap = new Map<string, number>();
    for (const community of orgCommunities) {
      const orgId = community.organization_id;
      orgCommunityCountMap.set(orgId, (orgCommunityCountMap.get(orgId) || 0) + 1);
    }

    // Step 6: Create invoices
    const newInvoices: any[] = [];

    for (const [orgId, communities] of orgMap) {
      const totalCommunitiesInOrg = orgCommunityCountMap.get(orgId) || 1;
      const discountPercentage = getDiscountPercentage(totalCommunitiesInOrg);

      console.log(`Org ${orgId}: ${totalCommunitiesInOrg} communities total, ${discountPercentage}% discount`);

      for (const community of communities) {
        const tier = community.membership_tier as 'gold' | 'silver';
        // Base annual prices in cents
        const baseAmountCents = tier === 'gold' ? 500000 : 250000;

        const periodStart = community.nextPeriodStart;
        // Full year invoice: period_end = period_start + 1 year
        const periodEnd = addYears(periodStart, 1);

        console.log(
          `Community ${community.name}: tier=${tier}, amount=${baseAmountCents}, ` +
          `period=${periodStart} to ${periodEnd}, discount=${discountPercentage}%`
        );

        newInvoices.push({
          issue_date: todayYMD,
          period_start: periodStart,
          period_end: periodEnd,
          amount_cents: baseAmountCents,
          currency: "USD",
          status: "issued",
          community_id: community.id,
          discount_percentage: discountPercentage,
          community_code: community.code,
          community_name: community.name,
        });
      }
    }

    if (newInvoices.length === 0) {
      console.log("No new invoices to create.");
      return new Response(
        JSON.stringify({ message: "No new invoices to create", created: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert invoices
    const { data: inserted, error: insertError } = await supabase
      .from("invoices")
      .insert(newInvoices)
      .select();

    if (insertError) {
      console.error("Error inserting invoices:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Successfully created ${inserted?.length ?? 0} invoices for organization communities.`);

    return new Response(
      JSON.stringify({
        message: "Organization community invoices generated successfully",
        created: inserted?.length ?? 0,
        data: inserted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("🔥 Error in generate-org-invoices function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
