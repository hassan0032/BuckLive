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
      .select("*")
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

    // --- Step 2: Create new invoices for the next year ---
    const newInvoices = expiringInvoices.map((inv) => ({
      user_id: inv.user_id,
      issue_date: todayYMD,
      period_start: todayYMD,
      period_end: addYears(todayYMD, 1),
      amount_cents: inv.amount_cents,
      currency: inv.currency,
      status: "issued",
    }));

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
