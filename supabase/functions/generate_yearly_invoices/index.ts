import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore
import { createClient } from "npm:@supabase/supabase-js@2";

// --- CORS Headers ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// --- Helper Functions ---
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
  // Parse the date in New York time zone
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  date.setFullYear(date.getFullYear() + years);
  return formatYMD(date);
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

/**
 * BUCK LIVE COMMUNITY MANAGER INVOICING (v2.0 - NO PRORATION)
 *
 * Rules:
 * 1. No proration - each invoice covers exactly 1 year
 * 2. Period is decided based on community creation date
 * 3. First invoice of every community created after 24 hours of community creation
 * 4. Each invoice covers a complete 1-year period from community creation date
 * 5. period_start = community creation date + N years (where N is invoice number)
 * 6. period_end = community creation date + (N+1) years
 * 7. amount_cents = full annual amount (no proration)
 * 8. Discount applied only in frontend and PDF for flexibility
 */

// --- Main Function ---
// @ts-ignore
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Only allow POST for manual trigger
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Environment variables
    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Supabase Admin Client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = getCurrentDateInNY();
    const todayYMD = formatYMD(today);
    console.log(`Running yearly invoice generator for ${todayYMD} (New York time)`);

    const results = {
      renewalInvoicesCreated: 0,
      skippedNoBillingDate: 0,
      errors: [] as string[],
    };

    // =========================================================================
    // PART 1: Handle RENEWAL invoices (communities needing next annual invoice)
    // =========================================================================
    console.log("--- PART 1: Processing Renewal Invoices ---");

    // Find active communities that have at least one invoice
    const { data: renewalCommunities, error: renewalCommunitiesError } = await supabase
      .from("communities")
      .select("id, name, code, membership_tier, next_invoice_date, organization_id")
      .eq("is_active", true);

    if (renewalCommunitiesError) {
      console.error("Error fetching communities for renewal:", renewalCommunitiesError);
      results.errors.push(`Failed to fetch communities for renewal: ${renewalCommunitiesError.message}`);
    } else if (renewalCommunities && renewalCommunities.length > 0) {
      // Get communities that already have invoices
      const { data: invoicedCommunities, error: invoicedError } = await supabase
        .from("invoices")
        .select("community_id")
        .not("community_id", "is", null);

      if (invoicedError) {
        console.error("Error fetching invoiced communities:", invoicedError);
        results.errors.push(`Failed to fetch invoiced communities: ${invoicedError.message}`);
      } else {
        const invoiceCounts = new Map();
        (invoicedCommunities || []).forEach((inv: { community_id: string }) => {
          const current = invoiceCounts.get(inv.community_id) || 0;
          invoiceCounts.set(inv.community_id, current + 1);
        });

        // Filter to communities with existing invoices
        const communitiesWithInvoices = renewalCommunities.filter((c: { id: string }) => invoiceCounts.has(c.id));

        console.log(`Found ${communitiesWithInvoices.length} communities with existing invoices.`);

        for (const community of communitiesWithInvoices) {
          const { id: communityId, name: communityName, code: communityCode, membership_tier: tier, next_invoice_date: nextInvoiceDate } = community;
          const baseAmount = tier === 'gold' ? 500000 : 250000;

          // Only create invoice if next_invoice_date is less than or equal to today (in New York time)
          if (!nextInvoiceDate) {
            continue;
          }
          const invoiceDateInNY = formatYMD(new Date(nextInvoiceDate));
          if (invoiceDateInNY > todayYMD) {
            continue;
          }

          console.log(`Processing renewal invoice for community: ${communityName} (next_invoice_date: ${nextInvoiceDate})`);

          // Calculate period: use the next_invoice_date as both start and end of the billing period
          // Since we removed proration, each invoice covers exactly 1 year from the next_invoice_date
          const periodStart = formatYMD(new Date(nextInvoiceDate));
          const periodEnd = addYears(periodStart, 1);

          // For discount calculation, we need to determine if this is an organization community or standalone
          // Since we removed primary_manager, we'll check if there's an organization_id
          let discountPercentage = 0;

          if (community.organization_id) {
            // ORGANIZATION COMMUNITY - count all communities in the organization
            const { count, error: countError } = await supabase
              .from("communities")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", community.organization_id);

            if (!countError) {
              discountPercentage = getDiscountPercentage(count || 0);
              console.log(`Organization ${community.organization_id} has ${count} communities, discount: ${discountPercentage}%`);
            }
          } else {
            // STANDALONE COMMUNITY - count communities managed by community managers of this community
            const { data: managers, error: managerError } = await supabase
              .from("community_managers")
              .select("user_id")
              .eq("community_id", communityId);

            if (!managerError && managers && managers.length > 0) {
              // Get unique manager IDs
              const managerIds = [...new Set(managers.map((m: { user_id: string }) => m.user_id))];

              // Helper to get max count
              let maxCount = 0;

              // We need to fetch all management records for these managers to count per manager
              const { data: allManagementRecords, error: recordsError } = await supabase
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

          const amountBeforeDiscount = baseAmount;

          console.log(`Renewal: Community=${communityName}, tier=${tier}, periodStart=${periodStart}, periodEnd=${periodEnd}, amount_cents=${baseAmount}, discount=${discountPercentage}%`);

          const { error: insertError } = await supabase.from("invoices").insert({
            issue_date: todayYMD,
            period_start: periodStart,
            period_end: periodEnd,
            amount_cents: amountBeforeDiscount,
            currency: 'USD',
            status: 'issued',
            community_id: communityId,
            discount_percentage: discountPercentage,
            community_code: communityCode,
            community_name: communityName,
            community_tier: tier,
            organization_id: community.organization_id,
          });

          // Update next_invoice_date for the next billing cycle (store as New York time)
          if (!insertError) {
            const nextBillingDate = addYears(periodStart, 1);
            // Create a date object representing the next billing date at midnight in New York time
            const [year, month, day] = nextBillingDate.split('-').map(Number);
            const nextInvoiceDateTime = new Date(year, month - 1, day, 0, 0, 0);
            await supabase
              .from("communities")
              .update({ next_invoice_date: nextInvoiceDateTime.toISOString() })
              .eq("id", communityId);
          }

          if (insertError) {
            console.error(`Error creating renewal invoice for community ${communityId}:`, insertError);
            results.errors.push(`Failed to create renewal invoice for ${communityName}: ${insertError.message}`);
          } else {
            results.renewalInvoicesCreated++;
          }
        }
      }
    }

    // =========================================================================
    // Summary
    // =========================================================================
    console.log(`✅ Summary: Renewal=${results.renewalInvoicesCreated}, SkippedNoBillingDate=${results.skippedNoBillingDate}, Errors=${results.errors.length}`);

    return new Response(
      JSON.stringify({
        message: "Invoice generation completed",
        renewalInvoicesCreated: results.renewalInvoicesCreated,
        skippedNoBillingDate: results.skippedNoBillingDate,
        totalCreated: results.renewalInvoicesCreated,
        errors: results.errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("🔥 Error in generate-yearly-invoices function:", error);
    return new Response(
      // @ts-ignore
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
