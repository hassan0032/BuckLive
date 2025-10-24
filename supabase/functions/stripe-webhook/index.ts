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

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
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
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  console.log("🔍 Edge Function Environment Check:");
  console.log("  SUPABASE_URL:", supabaseUrl);
  console.log("  SUPABASE_SERVICE_ROLE_KEY exists:", !!supabaseServiceRoleKey);
  console.log("  STRIPE_SECRET_KEY exists:", !!stripeSecretKey);
  console.log("  STRIPE_WEBHOOK_SECRET exists:", !!stripeWebhookSecret);

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("❌ Missing environment variables:");
    console.error("  SUPABASE_URL:", supabaseUrl);
    console.error("  SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceRoleKey);
    console.error("  STRIPE_SECRET_KEY:", stripeSecretKey);
    console.error("  STRIPE_WEBHOOK_SECRET:", stripeWebhookSecret);
    throw new Error("Missing Supabase environment variables in Edge Function");
  }

  console.log("🔍 Creating Supabase client in Edge Function:");
  console.log("  URL:", supabaseUrl);
  console.log("  Key (first 20 chars):", supabaseServiceRoleKey?.substring(0, 20) + "...");
  console.log("  Authorization header:", req.headers.get("Authorization"));

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceRoleKey
  );
    
  console.log("✅ Supabase client created successfully in Edge Function");

  const signature = req.headers.get("stripe-signature");

  if (!signature || !stripeWebhookSecret) {
    return new Response(
      JSON.stringify({ error: "Missing signature or webhook secret" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);

    console.log("Webhook event type:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const tier = session.metadata?.tier;
        const email = session.metadata?.email;
        const firstName = session.metadata?.first_name;
        const lastName = session.metadata?.last_name;

        if (!userId) {
          console.error("Missing user ID in session metadata");
          break;
        }

        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          const { error: profileError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            {
              email: email,
              user_metadata: {
                first_name: firstName,
                last_name: lastName,
              },
            }
          );

          if (profileError) {
            console.error("Error updating auth user:", profileError);
          }

          const { error: updateError } = await supabaseAdmin
            .from("user_profiles")
            .upsert({
              id: userId,
              email: email,
              first_name: firstName,
              last_name: lastName,
              registration_type: "self_registered",
              stripe_customer_id: session.customer as string,
              subscription_id: session.subscription as string,
              subscription_status: subscription.status,
              payment_tier: tier,
              subscription_started_at: new Date(subscription.current_period_start * 1000).toISOString(),
              subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
              role: "member",
              community_id: null,
            });

          if (updateError) {
            console.error("Error updating user profile:", updateError);
          } else {
            console.log("User profile updated successfully for:", userId);
          }

          const { error: paymentError } = await supabaseAdmin
            .from("payments")
            .insert({
              user_id: userId,
              amount: session.amount_total! / 100,
              currency: session.currency,
              status: "succeeded",
              stripe_payment_intent_id: session.payment_intent as string,
              stripe_invoice_id: subscription.latest_invoice as string,
              description: `${tier} membership subscription`,
              metadata: {
                session_id: session.id,
                subscription_id: session.subscription,
                tier: tier,
              },
            });

          if (paymentError) {
            console.error("Error recording payment:", paymentError);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (profile) {
          const { error } = await supabaseAdmin
            .from("user_profiles")
            .update({
              subscription_status: subscription.status,
              subscription_started_at: new Date(subscription.current_period_start * 1000).toISOString(),
              subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("id", profile.id);

          if (error) {
            console.error("Error updating subscription status:", error);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (profile) {
          const { error } = await supabaseAdmin
            .from("user_profiles")
            .update({
              subscription_status: "canceled",
              payment_tier: null,
            })
            .eq("id", profile.id);

          if (error) {
            console.error("Error updating subscription on deletion:", error);
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: profile } = await supabaseAdmin
          .from("user_profiles")
          .select("id, payment_tier")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (profile) {
          const { error } = await supabaseAdmin
            .from("payments")
            .insert({
              user_id: profile.id,
              amount: invoice.amount_paid / 100,
              currency: invoice.currency,
              status: "succeeded",
              stripe_payment_intent_id: invoice.payment_intent as string,
              stripe_invoice_id: invoice.id,
              description: `${profile.payment_tier} membership renewal`,
              metadata: {
                invoice_id: invoice.id,
                subscription_id: invoice.subscription,
              },
            });

          if (error) {
            console.error("Error recording payment:", error);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: profile } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (profile) {
          const { error } = await supabaseAdmin
            .from("user_profiles")
            .update({
              subscription_status: "past_due",
            })
            .eq("id", profile.id);

          if (error) {
            console.error("Error updating subscription status on payment failure:", error);
          }
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Webhook error:", error);
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
