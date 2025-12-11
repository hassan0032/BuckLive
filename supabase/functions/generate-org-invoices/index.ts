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

// Calculate prorated amount based on billing anniversary
function calculateProratedAmount(
  baseAmountCents: number,
  billingDate: string,
  issueDate: string
): number {
  const billing = new Date(billingDate);
  const issue = new Date(issueDate);
  
  // Get next anniversary date
  let nextAnniversary = new Date(billing);
  nextAnniversary.setFullYear(issue.getFullYear());
  
  // If the anniversary has passed this year, use next year's
  if (nextAnniversary <= issue) {
    nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);
  }
  
  // Calculate days until anniversary
  const daysUntilAnniversary = Math.ceil(
    (nextAnniversary.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Prorate based on 365 days
  const proratedAmount = Math.round((baseAmountCents * daysUntilAnniversary) / 365);
  
  return proratedAmount;
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

    // Step 1: Find all communities that belong to an organization and don't have a valid invoice
    const { data: orgCommunities, error: communityError } = await supabase
      .from("communities")
      .select(`
        id,
        name,
        membership_tier,
        organization_id,
        organizations:organization_id (
          id,
          name,
          billing_date
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

    // Step 2: Fetch existing valid invoices for these communities
    const { data: existingInvoices, error: invoiceError } = await supabase
      .from("invoices")
      .select("community_id, period_end")
      .in("community_id", communityIds)
      .gte("period_end", todayYMD);

    if (invoiceError) {
      console.error("Error fetching existing invoices:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set of community IDs that already have valid invoices
    const communitiesWithInvoices = new Set(
      existingInvoices?.map((inv: any) => inv.community_id) || []
    );

    // Step 3: Filter communities that need invoices
    const communitiesNeedingInvoices = orgCommunities.filter(
      (c: any) => !communitiesWithInvoices.has(c.id)
    );

    if (communitiesNeedingInvoices.length === 0) {
      console.log("All organization communities have valid invoices.");
      return new Response(
        JSON.stringify({ message: "All organization communities have valid invoices", created: 0 }),
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

    // Step 5: For each organization, count TOTAL communities (including those with existing invoices)
    // to determine the correct discount
    const orgCommunityCountMap = new Map<string, number>();
    for (const community of orgCommunities) {
      const orgId = community.organization_id;
      orgCommunityCountMap.set(orgId, (orgCommunityCountMap.get(orgId) || 0) + 1);
    }

    // Step 6: Create invoices
    const newInvoices: any[] = [];

    for (const [orgId, communities] of orgMap) {
      // Get organization details from the first community
      const orgDetails = Array.isArray(communities[0].organizations)
        ? communities[0].organizations[0]
        : communities[0].organizations;

      if (!orgDetails) {
        console.log(`Skipping communities for org ${orgId} - no org details found`);
        continue;
      }

      const billingDate = orgDetails.billing_date;
      const totalCommunitiesInOrg = orgCommunityCountMap.get(orgId) || 1;
      const discountPercentage = getDiscountPercentage(totalCommunitiesInOrg);

      console.log(`Org ${orgDetails.name}: ${totalCommunitiesInOrg} communities, ${discountPercentage}% discount`);

      for (const community of communities) {
        const tier = community.membership_tier as 'gold' | 'silver';
        const baseAmountCents = tier === 'gold' ? 500000 : 250000;

        // Calculate period end based on billing anniversary
        let periodEnd: string;
        const billingDateObj = new Date(billingDate);
        const todayObj = new Date(todayYMD);
        
        // Next anniversary
        let nextAnniversary = new Date(billingDateObj);
        nextAnniversary.setFullYear(todayObj.getFullYear());
        
        if (nextAnniversary <= todayObj) {
          nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);
        }
        
        periodEnd = formatYMD(nextAnniversary);

        // Calculate prorated amount if not a full year
        const daysUntilAnniversary = Math.ceil(
          (nextAnniversary.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Only prorate if less than 365 days
        const amountCents = daysUntilAnniversary < 365
          ? calculateProratedAmount(baseAmountCents, billingDate, todayYMD)
          : baseAmountCents;

        console.log(
          `Community ${community.name}: tier=${tier}, base=${baseAmountCents}, ` +
          `prorated=${amountCents}, days=${daysUntilAnniversary}, discount=${discountPercentage}%`
        );

        newInvoices.push({
          issue_date: todayYMD,
          period_start: todayYMD,
          period_end: periodEnd,
          amount_cents: amountCents,
          currency: "USD",
          status: "issued",
          community_id: community.id,
          discount_percentage: discountPercentage,
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
