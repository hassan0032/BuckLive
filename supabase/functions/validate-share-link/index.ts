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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { token, contentId } = await req.json();

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

    // 2️⃣ Determine allowed tiers - ONLY show content for the exact tier
    const allowedTiers = [membershipTier];

    // 3️⃣ Fetch content
    let query = supabase
      .from("content")
      .select("*")
      .eq("status", "published")
      .in("required_tier", allowedTiers)
      .order("created_at", { ascending: false });

    if (contentId) query = query.eq("id", contentId);

    const { data: contentData, error: contentError } = await query;

    if (contentError) {
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching content" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4️⃣ Ensure updated_at exists
    const contentWithUpdatedAt = (contentData || []).map(item => ({
      ...item,
      updated_at: item.updated_at || item.created_at,
    }));

    // If contentId was sent, return single object
    const contentResult = contentId ? contentWithUpdatedAt[0] || null : contentWithUpdatedAt;

    return new Response(
      JSON.stringify({
        success: true,
        community,
        content: contentResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});