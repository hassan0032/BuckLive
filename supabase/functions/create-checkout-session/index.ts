import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@19";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    
    console.log("🔍 Stripe Environment Check:");
    console.log("  STRIPE_SECRET_KEY exists:", !!stripeSecretKey);
    console.log("  STRIPE_SECRET_KEY (first 10 chars):", stripeSecretKey?.substring(0, 10) + "...");
    
    if (!stripeSecretKey) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable in Edge Function");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-10-28.acacia",
    });
    
    console.log("✅ Stripe client created successfully");

    // In Supabase Edge Functions, these should be available automatically
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    console.log("🔍 Edge Function Environment Check:");
    console.log("  SUPABASE_URL:", supabaseUrl);
    console.log("  SUPABASE_ANON_KEY exists:", !!supabaseAnonKey);
    console.log("  STRIPE_SECRET_KEY exists:", !!Deno.env.get("STRIPE_SECRET_KEY"));

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ Missing environment variables:");
      console.error("  SUPABASE_URL:", supabaseUrl);
      console.error("  SUPABASE_ANON_KEY:", supabaseAnonKey);
      throw new Error("Missing Supabase environment variables in Edge Function");
    }

    console.log("🔍 Creating Supabase client in Edge Function:");
    console.log("  URL:", supabaseUrl);
    console.log("  Key (first 20 chars):", supabaseAnonKey?.substring(0, 20) + "...");
    console.log("  Authorization header:", req.headers.get("Authorization"));

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );
    
    console.log("✅ Supabase client created successfully in Edge Function");

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { tier, email, firstName, lastName } = await req.json();

    if (!tier || !email || !firstName || !lastName) {
      throw new Error("Missing required fields: tier, email, firstName, lastName");
    }

    if (tier !== "silver" && tier !== "gold") {
      throw new Error("Invalid tier. Must be 'silver' or 'gold'");
    }

    const prices: { [key: string]: number } = {
      silver: 1900,
      gold: 4900,
    };

    const priceInCents = prices[tier];

    let customer;
    const { data: profile } = await supabaseClient
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.stripe_customer_id) {
      customer = await stripe.customers.retrieve(profile.stripe_customer_id);
    } else {
      customer = await stripe.customers.create({
        email: email,
        name: `${firstName} ${lastName}`,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      await supabaseClient
        .from("user_profiles")
        .update({ stripe_customer_id: customer.id })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Membership`,
              description: `Monthly ${tier} tier membership`,
            },
            unit_amount: priceInCents,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/payment-cancelled`,
      metadata: {
        supabase_user_id: user.id,
        tier: tier,
        email: email,
        first_name: firstName,
        last_name: lastName,
      },
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
