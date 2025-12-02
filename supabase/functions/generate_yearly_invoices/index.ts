
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
    // --- Step 2: Create new invoices for the next year with tier-based pricing ---
    const newInvoices: any[] = [];
    for (const inv of expiringInvoices) {
      const tier = inv.community?.membership_tier as 'gold' | 'silver' | undefined;
      const communityName = inv.community?.name;
      const amount = tier === 'gold' ? 500000 : 250000;
      const communityId = inv.community_id;
      if (!communityId) {
        console.log(`Skipping invoice without community_id`);
        continue;
      }
      // Generate next invoice number for this community
      const { data: invoiceNo, error: rpcError } = await supabase
        .rpc('generate_next_invoice_no', { p_community_id: communityId });
      if (rpcError) {
        console.error(`Error generating invoice number for ${communityName}:`, rpcError);
        continue;
      }
      if (!invoiceNo && invoiceNo !== 0) {
        console.error(`Null invoice number returned for ${communityName}`);
        continue;
      }
      console.log(`Community=${communityName ?? 'unknown'}, tier=${tier ?? 'unknown'}, amount=${amount}, invoice_no=${invoiceNo}`);
      newInvoices.push({
        issue_date: todayYMD,
        period_start: todayYMD,
        period_end: addYears(todayYMD, 1),
        amount_cents: amount,
        currency: 'USD',
        status: 'issued',
        community_id: communityId,
        invoice_no: invoiceNo,
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