import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: CORS });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pub = Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
  const priv = Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
  const subjectValue = Deno.env.get("VAPID_SUBJECT")?.trim();
  if (!url || !anon || !service || !pub || !priv || !subjectValue) {
    return json(500, { error: "Server notification configuration is incomplete" });
  }

  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: "Authentication required" });

  const authClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "Invalid session" });

  const db = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: admin, error: adminError } = await db
    .from("admins")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .eq("disabled", false)
    .maybeSingle();
  if (adminError || !admin) return json(403, { error: "Administrator access required" });

  // Fixed, server-side parent target for this dedicated diagnostic endpoint.
  const testParentId = "511a4635-d806-4348-8c3f-6c2d839b475f";
  const { data: subs, error: subError } = await db
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,device_type,device_label,updated_at")
    .eq("parent_user_id", testParentId)
    .eq("role", "parent")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(10);
  if (subError) return json(500, { error: "Unable to inspect test subscription" });
  if (!subs?.length) {
    return json(404, {
      error: "No active test subscription found. Sign in to the parent app and enable notifications first.",
    });
  }

  // Prioritize mobile devices first so an active desktop session never shadows the admin's Android phone.
  const orderedSubs = [...subs].sort((a, b) => {
    const aMob = a.device_type === "mobile" ? 0 : 1;
    const bMob = b.device_type === "mobile" ? 0 : 1;
    return aMob - bMob;
  }).slice(0, 5);

  const correlationId = crypto.randomUUID();
  const subject = /^mailto:|^https?:\/\//i.test(subjectValue) ? subjectValue : "mailto:" + subjectValue;
  webpush.setVapidDetails(subject, pub, priv);

  const payload = JSON.stringify({
    title: "دار الإحسان",
    body: "هذا إشعار تجريبي للتأكد من عمل الإشعارات على هاتفك.",
    icon: "./icon-192.png",
    badge: "./logo-sq.png",
    url: "./parent.html",
    tag: "dar-ihsan-push-test-" + Date.now(),
    requireInteraction: true,
    data: { url: "./parent.html", test: true, correlationId },
  });

  let acceptedCount = 0;
  let lastStatusCode: number | null = null;
  const acceptedDevices: string[] = [];

  for (const sub of orderedSubs) {
    try {
      const result = await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 300, urgency: "high" },
      );
      const statusCode = Number((result as { statusCode?: number })?.statusCode) || 201;
      lastStatusCode = statusCode;
      acceptedCount++;
      acceptedDevices.push(sub.device_type || "unknown");
      await db.from("notification_logs").insert({
        outbox_id: null,
        correlation_id: correlationId,
        subscription_id: sub.id,
        endpoint: sub.endpoint,
        status_code: statusCode,
        response_body: "Standalone test accepted by push service",
        success: true,
        error_type: null,
      });
    } catch (err) {
      const e = err as { statusCode?: number; body?: string; message?: string };
      const status = Number(e.statusCode) || null;
      lastStatusCode = status;
      const message = String(e.body || e.message || "Push delivery failed").slice(0, 500);
      const transient = !status || status === 408 || status === 429 || status >= 500;
      await db.from("notification_logs").insert({
        outbox_id: null,
        correlation_id: correlationId,
        subscription_id: sub.id,
        endpoint: sub.endpoint,
        status_code: status,
        response_body: message,
        success: false,
        error_type: transient ? "transient" : "permanent",
      });
      if ([401, 403, 404, 410].includes(status || 0)) {
        await db.from("push_subscriptions").update({ is_active: false }).eq("id", sub.id);
      }
    }
  }

  if (acceptedCount > 0) {
    return json(200, {
      ok: true,
      accepted: true,
      acceptedCount,
      statusCode: lastStatusCode || 201,
      deviceType: acceptedDevices[0],
      deviceTypes: acceptedDevices,
      correlationId,
      message: "Push service accepted the test notification; device display is not guaranteed.",
    });
  }

  return json(502, {
    error: "Push test failed",
    statusCode: lastStatusCode,
    correlationId,
    message:
      lastStatusCode === 403
        ? "This device subscription was rejected by the push service (often an old VAPID key). Sign in again in the parent app to renew it."
        : lastStatusCode === 404 || lastStatusCode === 410
          ? "This device subscription has expired and was deactivated. Sign in again in the parent app to renew it."
          : "The push service rejected the test notification.",
  });
});
