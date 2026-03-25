// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CommunityCreatedPayload {
  communityId: string;
  communityName: string;
  managerId?: string | null;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { communityId, communityName, managerId }: CommunityCreatedPayload = await req.json();

    if (!communityId || !communityName) {
      return new Response(
        JSON.stringify({ error: "communityId and communityName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Supabase Admin Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ Missing Supabase config.");
      return new Response(
        JSON.stringify({ error: "Supabase config missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Optional: Fetch manager info
    let managerName = "Unknown Manager";
    let managerEmail: string | null = null;

    if (managerId) {
      const { data: profile, error } = await supabaseAdmin
        .from("user_profiles")
        .select("first_name, last_name, email")
        .eq("id", managerId)
        .maybeSingle();

      if (profile && !error) {
        const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
        managerName = fullName || profile.email || managerName;
        managerEmail = profile.email ?? null;
      }
    }

    // MS Graph API configuration
    const tenantId = Deno.env.get("MS_TENANT_ID");
    const clientId = Deno.env.get("MS_CLIENT_ID");
    const clientSecret = Deno.env.get("MS_CLIENT_SECRET");
    const senderEmail = Deno.env.get("MS_SENDER_EMAIL");
    const ADMIN_EMAIL_RAW = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");


    // Parse comma-separated email addresses
    const adminEmails = ADMIN_EMAIL_RAW
      ? ADMIN_EMAIL_RAW.split(",").map(email => email.trim()).filter(email => email.length > 0)
      : [];

    if (!tenantId || !clientId || !clientSecret || !senderEmail || adminEmails.length === 0) {
      console.warn("⚠️ Missing MS Graph credentials or admin email. Email not sent.");
    } else {
      // 1. Get Access Token
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const tokenParams = new URLSearchParams();
      tokenParams.append("client_id", clientId);
      tokenParams.append("scope", "https://graph.microsoft.com/.default");
      tokenParams.append("client_secret", clientSecret);
      tokenParams.append("grant_type", "client_credentials");

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Failed to get MS Graph token: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const emailHTML = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f7f7f7; max-width: 600px;">
          <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #2c3e50; margin-top: 0; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
              New Community Created
            </h2>
            <div style="margin: 20px 0;">
              <p style="font-size: 16px; color: #2c3e50; line-height: 1.6;">
                A new community has been set up on BuckLive:
              </p>
              <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin: 15px 0;">
                <p style="font-size: 18px; color: #2c3e50; margin: 0; font-weight: bold;">
                  ${communityName}
                </p>
              </div>
              <div style="margin-top: 20px;">
                <p style="font-size: 14px; color: #555; margin: 8px 0;">
                  <strong style="color: #2c3e50;">Community Manager:</strong> ${managerName}
                </p>
                ${managerEmail ? `
                  <p style="font-size: 14px; color: #555; margin: 8px 0;">
                    <strong style="color: #2c3e50;">Contact:</strong> 
                    <a href="mailto:${managerEmail}" style="color: #3498db; text-decoration: none;">${managerEmail}</a>
                  </p>
                ` : ""}
              </div>
            </div>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
            <p style="font-size: 12px; color: #999; margin: 0; text-align: center;">
              This is an automated notification from BuckLive. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      const sendUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
      const toRecipients = adminEmails.map(email => ({ emailAddress: { address: email.trim() } }));

      const messageData = {
        message: {
          subject: `New Community Created: ${communityName}`,
          body: {
            contentType: "HTML",
            content: emailHTML,
          },
          toRecipients: toRecipients,
        },
        saveToSentItems: "false"
      };

      const sendResponse = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
      });

      if (!sendResponse.ok) {
        const errorText = await sendResponse.text();
        throw new Error(`Failed to send MS Graph email: ${errorText}`);
      }

      console.log(`📧 Email sent via Microsoft Graph API for community: ${communityId} to ${adminEmails.length} recipient(s): ${adminEmails.join(", ")}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("🔥 Edge Function Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
