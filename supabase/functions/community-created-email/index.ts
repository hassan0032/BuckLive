// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";

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

    // Gmail SMTP configuration
    const SMTP_USER = Deno.env.get("SMTP_USER"); // bucklivenotifications@gmail.com
    const SMTP_PASS = Deno.env.get("SMTP_PASS"); // Gmail App Password
    const ADMIN_EMAIL_RAW = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
    const SMTP_SENDER = Deno.env.get("SMTP_SENDER") || `Buck Live Notifications <${SMTP_USER}>`;

    // Parse comma-separated email addresses
    const adminEmails = ADMIN_EMAIL_RAW
      ? ADMIN_EMAIL_RAW.split(",").map(email => email.trim()).filter(email => email.length > 0)
      : [];

    if (!SMTP_USER || !SMTP_PASS || adminEmails.length === 0) {
      console.warn("⚠️ Missing SMTP credentials or admin email. Email not sent.");
    } else {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465, // SSL
        secure: true,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

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

      await transporter.sendMail({
        from: SMTP_SENDER,
        to: adminEmails.join(", "),
        subject: `New Community Created: ${communityName}`,
        html: emailHTML,
      });

      console.log(`📧 Email sent via Gmail SMTP for community: ${communityId} to ${adminEmails.length} recipient(s): ${adminEmails.join(", ")}`);
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
