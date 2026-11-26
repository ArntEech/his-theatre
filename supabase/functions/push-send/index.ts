// His Theatre: delivers waiting phone notifications.
//
// The database writes messages to a private outbox and pokes this function. It collects them
// with the server key (claim_push_jobs, which phones can't call) and sends each one through
// Google or Apple's push service, signed with the ministry's notification key. That key pair is
// made here the first time this runs and kept in a private database table: the private half
// never leaves the server. Calling this with nothing waiting does nothing, so it needs no
// password of its own.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

type Job = { id: number; kind: string; title: string; body: string; url: string; endpoint: string; p256dh: string; auth: string };

Deno.serve(async () => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let { data: keys } = await db.rpc("push_keys_get");
  if (!keys?.length) {
    const fresh = webpush.generateVAPIDKeys();
    await db.rpc("push_keys_init", { p_public: fresh.publicKey, p_private: fresh.privateKey });
    ({ data: keys } = await db.rpc("push_keys_get"));
  }
  const key = keys?.[0];
  if (!key) return Response.json({ error: "No notification keys." }, { status: 500 });
  webpush.setVapidDetails("https://his-theatre.vercel.app", key.public_key, key.private_key);

  let sent = 0;
  let gone = 0;
  for (let round = 0; round < 5; round++) {
    const { data: jobs, error } = await db.rpc("claim_push_jobs");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!jobs?.length) break;
    await Promise.all(
      (jobs as Job[]).map(async (j) => {
        try {
          await webpush.sendNotification(
            { endpoint: j.endpoint, keys: { p256dh: j.p256dh, auth: j.auth } },
            JSON.stringify({ title: j.title, body: j.body, url: j.url, tag: `${j.kind}-${j.id}` }),
            { TTL: 60 * 60 * 24, urgency: j.kind === "urgent" ? "high" : "normal" },
          );
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.rpc("drop_push_subscription", { p_endpoint: j.endpoint });
            gone++;
          }
        }
      }),
    );
  }
  return Response.json({ sent, gone });
});
