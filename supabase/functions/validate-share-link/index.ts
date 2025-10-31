import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, apikey",
};

const tierLevels: Record<string, number> = {
  silver: 1,
  gold: 2,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Missing token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1️⃣ Validate community
    const { data: community, error: communityError } = await supabase
      .from("communities")
      .select("id, name, is_sharable, sharable_token, membership_tier")
      .eq("sharable_token", token)
      .eq("is_sharable", true)
      .single();

    if (communityError || !community) {
      console.error("Community error:", communityError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or disabled share link" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const membershipTier = community.membership_tier.toLowerCase();
    const tierLevel = tierLevels[membershipTier];

    if (!tierLevel) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid membership tier" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2️⃣ Determine accessible tiers
    const allowedTiers = Object.entries(tierLevels)
      .filter(([_, level]) => level <= tierLevel)
      .map(([tier]) => tier);

    console.log("Allowed tiers for community:", allowedTiers);

    // 3️⃣ Fetch content matching allowed tiers
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("id, title, description, required_tier")
      .in("required_tier", allowedTiers);

    if (contentError) {
      console.error("Content fetch error:", contentError);
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching content" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        community,
        content,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});