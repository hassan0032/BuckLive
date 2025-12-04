
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// --- CORS Headers ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
// --- Helper Functions ---
function formatYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}
function addYears(ymd: string, years: number) {
  const date = new Date(ymd);
  date.setFullYear(date.getFullYear() + years);
  return formatYMD(date);
}
// --- Main Function ---
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }
    // Supabase Admin Client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date();
    const todayYMD = formatYMD(today);
    console.log(`Running yearly invoice generator for ${todayYMD}`);
    // --- Step 1: Find all invoices expiring today ---
    const { data: expiringInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select("*, community:community_id(name, membership_tier)")
      .eq("period_end", todayYMD);
    if (fetchError) {
      console.error("Error fetching expiring invoices:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!expiringInvoices || expiringInvoices.length === 0) {
      console.log("No invoices expiring today.");
      return new Response(
        JSON.stringify({ message: "No invoices expiring today" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log(`Found ${expiringInvoices.length} expiring invoices.`);

    // Helper function to calculate discount percentage based on community count
    const getDiscountPercentage = (communityCount: number): number => {
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
    };

    // --- Step 2: Create new invoices for the next year with tier-based pricing and discount ---
    const newInvoices: any[] = [];
    for (const inv of expiringInvoices) {
      const tier = inv.community?.membership_tier as 'gold' | 'silver' | undefined;
      const communityName = inv.community?.name;
      const baseAmount = tier === 'gold' ? 500000 : 250000;
      const communityId = inv.community_id;

      if (!communityId) {
        console.log(`Skipping invoice without community_id`);
        continue;
      }

      // Fetch the community to get its primary_manager
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("primary_manager")
        .eq("id", communityId)
        .single();

      if (communityError) {
        console.error(`Error fetching community ${communityId}:`, communityError);
      }

      let discountPercentage = 0;

      // If community has a primary_manager, calculate discount based on their total communities
      if (community?.primary_manager) {
        // Count how many communities this primary_manager manages
        const { count, error: countError } = await supabase
          .from("communities")
          .select("id", { count: "exact", head: true })
          .eq("primary_manager", community.primary_manager);

        if (countError) {
          console.error(`Error counting communities for primary_manager:`, countError);
        } else {
          discountPercentage = getDiscountPercentage(count || 0);
          console.log(`Primary manager ${community.primary_manager} has ${count} communities, discount: ${discountPercentage}%`);
        }
      }

      console.log(`Community=${communityName ?? 'unknown'}, tier=${tier ?? 'unknown'}, baseAmount=${baseAmount}, discount=${discountPercentage}%`);

      newInvoices.push({
        issue_date: todayYMD,
        period_start: todayYMD,
        period_end: addYears(todayYMD, 1),
        amount_cents: baseAmount,
        currency: 'USD',
        status: 'issued',
        community_id: communityId,
        discount_percentage: discountPercentage,
      });
    }

    if (newInvoices.length === 0) {
      console.log("No new invoices to create (all communities skipped or failed).");
      return new Response(
        JSON.stringify({ message: "No new invoices to create" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insertError } = await supabase.from("invoices").insert(newInvoices);
    if (insertError) {
      console.error("Error inserting new invoices:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create new invoices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Successfully created ${newInvoices.length} new invoices.`);
    return new Response(
      JSON.stringify({
        message: "Yearly invoices generated successfully",
        created: newInvoices.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("🔥 Error in generate-yearly-invoices function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});