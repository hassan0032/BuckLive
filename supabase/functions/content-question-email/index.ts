// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface QuestionPayload {
  name: string;
  email: string;
  question: string;
  content_title: string;
  content_id: string;
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
    const { name, email, question, content_title, content_id }: QuestionPayload = await req.json();

    if (!name || !question || !content_title || !content_id) {
      return new Response(
        JSON.stringify({ error: "name, question, content_title, and content_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gmail SMTP configuration
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    const SMTP_SENDER = Deno.env.get("SMTP_SENDER") || `Buck Live Notifications <${SMTP_USER}>`;
    const RECIPIENT_EMAIL = Deno.env.get("QUESTION_RECIPIENT_EMAIL") || "asim@vitalmindmedia.com";

    if (!SMTP_USER || !SMTP_PASS) {
      console.warn("⚠️ Missing SMTP credentials. Email not sent.");
      return new Response(
        JSON.stringify({ success: false, error: "SMTP credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465, // SSL
      secure: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    const isAnonymous = !email || email === "Anonymous";
    const displayEmail = isAnonymous ? "Anonymous" : email;
    const currentTime = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const emailHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #f7f7f7; max-width: 600px;">
        <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #2c3e50; margin-top: 0; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
            New Question on Buck LIVE
          </h2>
          <div style="margin: 20px 0;">
            <p style="font-size: 16px; color: #2c3e50; line-height: 1.6;">
              A user has submitted a question about the following content:
            </p>
            <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin: 15px 0;">
              <p style="font-size: 18px; color: #2c3e50; margin: 0; font-weight: bold;">
                ${content_title}
              </p>
            </div>
            <div style="margin-top: 20px;">
              <p style="font-size: 14px; color: #555; margin: 8px 0;">
                <strong style="color: #2c3e50;">From:</strong> ${name}
              </p>
              <p style="font-size: 14px; color: #555; margin: 8px 0;">
                <strong style="color: #2c3e50;">Email:</strong> ${displayEmail}
              </p>
              <p style="font-size: 14px; color: #555; margin: 8px 0;">
                <strong style="color: #2c3e50;">Submitted:</strong> ${currentTime}
              </p>
            </div>
            <div style="background: #fff9e6; padding: 15px; border-left: 4px solid #f39c12; margin: 20px 0;">
              <p style="font-size: 14px; color: #2c3e50; margin: 0 0 5px 0;">
                <strong>Question:</strong>
              </p>
              <p style="font-size: 14px; color: #2c3e50; margin: 0; white-space: pre-wrap;">
                ${question}
              </p>
            </div>
            <div style="margin-top: 20px;">
              <p style="font-size: 12px; color: #777; margin: 8px 0;">
                <strong>Content ID:</strong> ${content_id}
              </p>
            </div>
          </div>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #999; margin: 0; text-align: center;">
            This is an automated notification from Buck LIVE. ${isAnonymous ? "This question was submitted anonymously." : `Reply to ${email} to answer this question.`}
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: SMTP_SENDER,
      to: RECIPIENT_EMAIL,
      replyTo: isAnonymous ? undefined : email,
      subject: `New Question on Buck LIVE: ${content_title}`,
      html: emailHTML,
    });

    console.log(`📧 Question email sent to ${RECIPIENT_EMAIL} for content: ${content_title}`);

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
