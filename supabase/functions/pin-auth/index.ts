// His Theatre: member sign-in with Member ID + PIN.
//
// Paste this into Supabase → Edge Functions → Deploy a new function → Via editor,
// name it exactly: pin-auth. Then, in its settings, turn OFF "Verify JWT"
// (members aren't signed in yet when they call it; this function does its own checks).
//
// What it does:
//   action "login":    checks Member ID + PIN in the database (lockouts and per-device limits
//                      live there), then returns a sign-in session.
//   action "activate": checks the one-time setup code, saves the new PIN, returns a session.
//
// The PIN is never stored or logged here. The service key never leaves Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// Supabase provides SUPABASE_SERVICE_ROLE_KEY automatically. If your project only has the newer
// "secret" keys, add one under Edge Functions → Secrets with the name SERVICE_KEY.
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!SERVICE_KEY) console.error("pin-auth: no service key. Add a secret named SERVICE_KEY.");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });
}

const SORRY = "Sign-in isn't working right now. Please try again in a minute.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ ok: false, error: SORRY });

  let body: { action?: string; memberCode?: string; pin?: string; setupCode?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: SORRY });
  }

  // The device address, for the "20 tries per 15 minutes" limit.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const memberCode = String(body.memberCode ?? "").slice(0, 20);
  const pin = String(body.pin ?? "").slice(0, 8);

  try {
    let check;
    if (body.action === "login") {
      check = await admin.rpc("pin_login_check", { p_code: memberCode, p_pin: pin, p_ip: ip });
    } else if (body.action === "activate") {
      const setupCode = String(body.setupCode ?? "").slice(0, 12);
      check = await admin.rpc("activate_member", { p_code: memberCode, p_setup: setupCode, p_pin: pin, p_ip: ip });
    } else {
      return reply({ ok: false, error: SORRY });
    }
    if (check.error) {
      console.error("rpc failed", check.error.message);
      return reply({ ok: false, error: SORRY });
    }
    const result = check.data as { ok: boolean; error?: string; member_id?: string };
    if (!result.ok || !result.member_id) return reply({ ok: false, error: result.error ?? SORRY });

    const session = await sessionFor(result.member_id);
    return reply({ ok: true, ...session });
  } catch (err) {
    console.error("pin-auth error", err instanceof Error ? err.message : err);
    return reply({ ok: false, error: SORRY });
  }
});

/** Makes (once) a hidden sign-in account for the member, then opens a session for it. */
async function sessionFor(memberId: string) {
  const { data: member, error } = await admin
    .from("members")
    .select("id, member_code, auth_user_id")
    .eq("id", memberId)
    .single();
  if (error || !member) throw new Error("member lookup failed");

  let email: string | undefined;
  if (member.auth_user_id) {
    const { data } = await admin.auth.admin.getUserById(member.auth_user_id);
    email = data.user?.email ?? undefined;
  }
  if (!email) {
    // Members never see or use this address; it only exists so Supabase can hold their session.
    email = `${String(member.member_code).toLowerCase()}@members.histheatre.app`;
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID() + crypto.randomUUID(), // random and never shown: password sign-in is useless for members
      email_confirm: true,
    });
    if (createError && !/already|exists|registered/i.test(createError.message)) throw createError;
  }

  // A one-time sign-in link, used straight away on the server (nothing is emailed).
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link?.properties?.hashed_token) throw linkError ?? new Error("no link");
  if (!member.auth_user_id && link.user?.id) {
    await admin.rpc("link_member_auth", { p_member: member.id, p_user: link.user.id });
  }

  // A fresh client, so the session it receives never replaces the server key used above.
  const verifier = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: verifyError } = await verifier.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verified.session) throw verifyError ?? new Error("no session");
  return { access_token: verified.session.access_token, refresh_token: verified.session.refresh_token };
}
