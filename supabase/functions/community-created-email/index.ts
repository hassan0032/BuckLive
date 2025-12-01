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
    const ADMIN_EMAIL = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
    const SMTP_SENDER = Deno.env.get("SMTP_SENDER") || `Buck Live Notifications <${SMTP_USER}>`;

    if (!SMTP_USER || !SMTP_PASS || !ADMIN_EMAIL) {
      console.warn("⚠️ Missing SMTP credentials or admin email. Email not sent.");
    } else {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465, // SSL
        secure: true,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      const emailHTML = `
        <div style="font-family: Arial, sans-serif; padding: 15px; background: #f7f7f7;">
          <h2 style="color: #2c3e50; margin-top: 0;">New Community Created</h2>
          <p style="font-size: 14px; color: #2c3e50;">
            <strong>${managerName}</strong> created a new community with the following name:
            <strong>${communityName}</strong>.
          </p>
          <p style="font-size: 14px; color: #333; margin-top: 10px;">
            <strong>Community ID:</strong> ${communityId}
          </p>
          ${managerEmail ? `
            <p style="font-size: 14px; color: #333; margin-top: 4px;">
              <strong>Manager Email:</strong> ${managerEmail}
            </p>
          ` : ""}
          <hr style="margin: 16px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #777; margin: 0;">
            This is an automated notification from BuckLive. Please do not reply to this email.
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: SMTP_SENDER,
        to: ADMIN_EMAIL,
        subject: `New Community Created: ${communityName}`,
        html: emailHTML,
      });

      console.log(`📧 Email sent via Gmail SMTP for community: ${communityId}`);
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
