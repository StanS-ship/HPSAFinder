// Receives contact form submissions, stores them, and emails them to the
// site owner via Resend.
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OWNER_EMAIL = "stan@grantsrepublic.com";
const MAX_LENGTHS = { name: 200, email: 320, message: 10000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Server-side abuse control: at most RATE_LIMIT_MAX submissions from the same
// caller within RATE_LIMIT_WINDOW_MS. The browser's disabled submit button is
// not a control — a direct HTTP call skips it entirely.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function callerIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0].trim();
  return first || req.headers.get("cf-connecting-ip") || "unknown";
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`hpsafinder-contact:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing authorization." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const name = clean(body.name, MAX_LENGTHS.name);
    const email = clean(body.email, MAX_LENGTHS.email);
    const message = clean(body.message, MAX_LENGTHS.message);

    if (!message) {
      return json({ error: "Please enter a message before sending." }, 400);
    }
    if (email && !EMAIL_RE.test(email)) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ipHash = await hashIp(callerIp(req));
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

    const { count: recentCount, error: throttleReadError } = await supabase
      .from("contact_submission_throttle")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", windowStart);

    if (throttleReadError) {
      console.error("Throttle read failed:", throttleReadError.message);
      return json({ error: "We could not accept your message right now. Please try again." }, 500);
    }

    if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
      return json(
        { error: "Too many messages sent recently. Please wait a few minutes and try again." },
        429,
      );
    }

    const { error: throttleWriteError } = await supabase
      .from("contact_submission_throttle")
      .insert({ ip_hash: ipHash });

    if (throttleWriteError) {
      console.error("Throttle write failed:", throttleWriteError.message);
      return json({ error: "We could not accept your message right now. Please try again." }, 500);
    }

    // Opportunistic cleanup of expired throttle rows.
    await supabase
      .from("contact_submission_throttle")
      .delete()
      .lt("created_at", new Date(Date.now() - RATE_LIMIT_WINDOW_MS * 6).toISOString());

    const { data: saved, error: saveError } = await supabase
      .from("contact_messages")
      .insert({ name: name || null, email: email || null, message })
      .select("id")
      .single();

    if (saveError || !saved) {
      console.error("Failed to store message:", saveError?.message);
      return json({ error: "We could not save your message. Please try again." }, 500);
    }

    // The key may be stored under its standard name or a custom name
    // (e.g. "HPSAFinder") — try both.
    const resendKey =
      Deno.env.get("RESEND_API_KEY") ??
      Deno.env.get("HPSAFinder") ??
      null;
    if (!resendKey || !resendKey.startsWith("re_")) {
      // Message is stored; email delivery stays 'pending' until the key is added.
      await supabase
        .from("contact_messages")
        .update({ email_status: "failed" })
        .eq("id", saved.id);
      return json({
        ok: true,
        stored: true,
        emailed: false,
        note: "Message saved. Email delivery is not configured yet.",
      });
    }

    const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "HPSA Finder <onboarding@resend.dev>";
    const subject = `HPSA Finder contact form: ${name || "New message"}`;
    const lines = [
      name && `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
      email && `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
      `<p><strong>Message:</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>`,
    ].filter(Boolean).join("\n");

    let emailed = false;
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [OWNER_EMAIL],
          reply_to: email || undefined,
          subject,
          html: lines,
        }),
      });
      if (resendRes.ok) {
        emailed = true;
      } else {
        const errText = await resendRes.text();
        console.error("Resend error:", resendRes.status, errText.slice(0, 500));
      }
    } catch (err) {
      console.error("Resend request failed:", err instanceof Error ? err.message : err);
    }

    await supabase
      .from("contact_messages")
      .update({ email_status: emailed ? "sent" : "failed" })
      .eq("id", saved.id);

    if (!emailed) {
      return json({
        ok: true,
        stored: true,
        emailed: false,
        note: "Message saved, but the email could not be delivered right now.",
      });
    }

    return json({ ok: true, stored: true, emailed: true });
  } catch (err) {
    console.error("contact-form error:", err instanceof Error ? err.message : err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
