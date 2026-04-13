import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// --- Helper Functions (Shared with generate_yearly_invoices) ---
const NEW_YORK_TIMEZONE = 'America/New_York';

function formatYMD(date: Date): string {
  const parts = date.toLocaleDateString('en-US', {
    timeZone: NEW_YORK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split('/');
  return `${parts[2]}-${parts[0]}-${parts[1]}`; // Convert MM/DD/YYYY to YYYY-MM-DD
}

function getCurrentDateInNY(): Date {
  const now = new Date();
  const nyTime = new Date(now.toLocaleString('en-US', { timeZone: NEW_YORK_TIMEZONE }));
  return new Date(nyTime.getFullYear(), nyTime.getMonth(), nyTime.getDate());
}

function addYears(ymd: string, years: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().split('T')[0];
}

function subDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().split('T')[0];
}

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

// @ts-ignore
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // @ts-ignore
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Parse request body for optional parameters
    let force = false;
    let requestedCommunityIds: string[] | null = null;

    try {
      const body = await req.json();
      force = body.force === true;
      requestedCommunityIds = Array.isArray(body.communityIds) ? body.communityIds : null;
      console.log(`Request parameters: force=${force}, communityIds=${requestedCommunityIds?.length || 'all'}`);
    } catch {
      // No body or invalid JSON - use defaults
      console.log('No request body - using default parameters');
    }

    // Use Service Role Key for admin operations
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const today = getCurrentDateInNY();
    const todayYMD = formatYMD(today);
    console.log(`Running create-first-invoice generator for ${todayYMD} (New York time)`);

    const results = {
      created: 0,
      skippedTooEarly: 0,
      errors: [] as string[],
    };

    // 1. Find active communities without any invoices
    const { data: allCommunities, error: communitiesError } = await supabaseClient
      .from("communities")
      .select("id, name, code, membership_tier, created_at, organization_id, activation_date")
      .eq("is_active", true);

    if (communitiesError) {
      console.error("Error fetching communities:", communitiesError);
      throw new Error(`Failed to fetch communities: ${communitiesError.message}`);
    }

    if (!allCommunities || allCommunities.length === 0) {
      console.log("No active communities found.");
      return new Response(
        JSON.stringify({ message: "No active communities found", results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all community IDs that already have invoices
    const { data: invoicedCommunities, error: invoicedError } = await supabaseClient
      .from("invoices")
      .select("community_id")
      .not("community_id", "is", null);

    if (invoicedError) {
      console.error("Error fetching invoiced communities:", invoicedError);
      throw new Error(`Failed to fetch invoiced communities: ${invoicedError.message}`);
    }

    const invoicedCommunityIds = new Set(
      (invoicedCommunities || []).map((i: { community_id: string }) => i.community_id)
    );

    // Filter to communities without any invoice
    let communitiesWithoutInvoice = allCommunities.filter(
      (c: { id: string }) => !invoicedCommunityIds.has(c.id)
    );

    // If specific community IDs were requested, filter to only those
    if (requestedCommunityIds && requestedCommunityIds.length > 0) {
      const requestedSet = new Set(requestedCommunityIds);
      communitiesWithoutInvoice = communitiesWithoutInvoice.filter(
        (c: { id: string }) => requestedSet.has(c.id)
      );
      console.log(`Filtered to ${communitiesWithoutInvoice.length} requested communities.`);
    }

    console.log(`Found ${communitiesWithoutInvoice.length} communities without invoices.`);

    for (const community of communitiesWithoutInvoice) {
      const { id: communityId, name: communityName, code: communityCode, membership_tier: tier, created_at: createdAt, activation_date: activationDate } = community;

      // 2. Check activation date
      if (!activationDate) {
        console.log(`Skipping community ${communityName}: No activation date set`);
        continue;
      }

      if (!force) {
        const actDatePrefix = (activationDate || "").split('T')[0];
        if (actDatePrefix > todayYMD) {
          console.log(`Skipping community ${communityName}: Activation date ${actDatePrefix} is in the future.`);
          results.skippedTooEarly++;
          continue;
        }
      } else {
        console.log(`Force mode enabled - bypassing date check for ${communityName}`);
      }

      console.log(`Processing first invoice for community: ${communityName} (Activation Date: ${activationDate})`);

      // 3. Calculate Invoice Details
      // The activation_date comes from the DB as a UTC string representing the chosen calendar day (e.g., "2026-04-13T00:00:00Z").
      // We directly extract the YYYY-MM-DD prefix to prevent local timezone shifts via 'new Date()'.
      const periodStart = (activationDate || "").split('T')[0];
      
      const period1Year = addYears(periodStart, 1);
      const periodEnd = subDays(period1Year, 1);

      const baseAmount = tier === 'gold' ? 500000 : 250000;

      // Calculate Discount
      let discountPercentage = 0;

      if (community.organization_id) {
        // ORGANIZATION COMMUNITY - count all communities in the organization
        const { count: communityCount, error: countError } = await supabaseClient
          .from("communities")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", community.organization_id);

        discountPercentage = countError ? 0 : getDiscountPercentage(communityCount || 0);
      } else {
        // STANDALONE COMMUNITY - count communities managed by community managers of this community
        const { data: managers, error: managerError } = await supabaseClient
          .from("community_managers")
          .select("user_id")
          .eq("community_id", communityId);

        if (!managerError && managers && managers.length > 0) {
          // Get unique manager IDs
          const managerIds = [...new Set(managers.map((m: { user_id: string }) => m.user_id))];

          // Helper to get max count
          let maxCount = 0;

          // We need to fetch all management records for these managers to count per manager
          const { data: allManagementRecords, error: recordsError } = await supabaseClient
            .from("community_managers")
            .select("user_id")
            .in("user_id", managerIds);

          if (!recordsError && allManagementRecords) {
            const countsByUser: Record<string, number> = {};

            // Count communities per manager
            for (const record of allManagementRecords) {
              const uid = record.user_id;
              countsByUser[uid] = (countsByUser[uid] || 0) + 1;
            }

            // Find the maximum count
            for (const count of Object.values(countsByUser)) {
              if (count > maxCount) {
                maxCount = count;
              }
            }

            discountPercentage = getDiscountPercentage(maxCount);
            console.log(`Community managers max portfolio size is ${maxCount}, discount: ${discountPercentage}%`);
          }
        }
      }

      console.log(`Creating First Invoice: Community=${communityName}, tier=${tier}, periodStart=${periodStart}, periodEnd=${periodEnd}, amount=${baseAmount}, discount=${discountPercentage}%`);

      // 4. Create Invoice
      const { error: insertError } = await supabaseClient.from("invoices").insert({
        issue_date: periodStart,
        period_start: periodStart,
        period_end: periodEnd,
        amount_cents: baseAmount,
        currency: 'USD',
        status: 'issued',
        community_id: communityId,
        discount_percentage: discountPercentage,
        community_code: communityCode,
        community_name: communityName,
        community_tier: tier,
        organization_id: community.organization_id,
      });

      if (insertError) {
        console.error(`Error creating invoice for community ${communityId}:`, insertError);
        results.errors.push(`Failed to create invoice for ${communityName}: ${insertError.message}`);
      } else {
        // 5. Update next_invoice_date
        // Set to exactly 1 year after activation date, so the cycle remains correct
        const nextBillingDate = period1Year;
        // Create a date object representing the next billing date at midnight in New York time
        const [year, month, day] = nextBillingDate.split('-').map(Number);
        const nextInvoiceDateTime = new Date(year, month - 1, day, 0, 0, 0);

        await supabaseClient
          .from("communities")
          .update({ next_invoice_date: nextInvoiceDateTime.toISOString() })
          .eq("id", communityId);

        results.created++;
      }
    }

    console.log(`✅ Create First Invoice Summary: Created=${results.created}, SkippedTooEarly=${results.skippedTooEarly}, Errors=${results.errors.length}`);

    return new Response(
      JSON.stringify({
        message: "First invoice generation completed",
        results
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("🔥 Error in create-first-invoice function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
