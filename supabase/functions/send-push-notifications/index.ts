import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SAFE_OUTBOX_START = "2026-11-22T13:18:55.538694Z";
const STALE_LOCK_MS = 2 * 60 * 1000;
const SEND_BATCH_SIZE = 10;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: CORS });

const log = (
  stage: string,
  outboxId: string,
  correlationId: string,
  extra: Record<string, unknown> = {},
) =>
  console.log(
    JSON.stringify({
      svc: "push-outbox",
      v: 19,
      stage,
      outbox_id: outboxId,
      correlation_id: correlationId,
      ...extra,
    }),
  );

function normalizedSubject(value: string): string {
  const v = value.trim();
  return /^mailto:|^https?:\/\//i.test(v) ? v : "mailto:" + v;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pub = Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
  const priv = Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
  const subject = Deno.env.get("VAPID_SUBJECT")?.trim();
  if (!url || !anon || !service || !pub || !priv || !subject) {
    console.error("Push worker configuration incomplete");
    return json(500, { error: "Server notification configuration is incomplete" });
  }

  const cronSecret = Deno.env.get("NOTIFICATION_CRON_SECRET")?.trim() ?? "";
  const suppliedCron = req.headers.get("x-cron-secret")?.trim() ?? "";
  const isCron = !!cronSecret && !!suppliedCron && suppliedCron === cronSecret;

  const db = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!isCron) {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return json(401, { error: "Authentication required" });

    const authClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) return json(401, { error: "Invalid session" });

    const { data: admin, error: adminError } = await db
      .from("admins")
      .select("user_id")
      .eq("user_id", data.user.id)
      .eq("disabled", false)
      .maybeSingle();
    if (adminError || !admin) return json(403, { error: "Administrator access required" });
  }

  try {
    webpush.setVapidDetails(normalizedSubject(subject), pub, priv);
  } catch (error) {
    console.error("VAPID setup failed", String(error).slice(0, 180));
    return json(500, { error: "VAPID configuration is invalid" });
  }

  let body: { limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* Cron may omit a body */
  }
  const limit = Math.min(50, Math.max(1, Math.floor(Number(body.limit) || 20)));

  const staleBefore = new Date(Date.now() - STALE_LOCK_MS).toISOString();
  await db
    .from("notification_outbox")
    .update({
      status: "pending",
      processing_started_at: null,
      error_message: "Recovered from stale processing lock",
    })
    .eq("status", "processing")
    .gte("created_at", SAFE_OUTBOX_START)
    .lt("processing_started_at", staleBefore)
    .lt("retry_count", 5);

  const { data: pending, error: queueError } = await db
    .from("notification_outbox")
    .select(
      "id,correlation_id,target_type,target_child_id,target_parent_id,target_section_id,event_type,title,body,url,tag,retry_count",
    )
    .in("status", ["pending", "failed"])
    .gte("created_at", SAFE_OUTBOX_START)
    .lte("scheduled_at", new Date().toISOString())
    .lt("retry_count", 5)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (queueError) {
    console.error("Push outbox read failed", queueError.message);
    return json(500, { error: "Unable to read notification queue" });
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of pending ?? []) {
    const corrId: string = item.correlation_id || item.id;
    const { data: claimed, error: claimError } = await db
      .from("notification_outbox")
      .update({
        status: "processing",
        processing_started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", item.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      skipped++;
      continue;
    }

    log("claimed", item.id, corrId, {
      event_type: item.event_type,
      target_type: item.target_type,
      retry_count: item.retry_count ?? 0,
    });

    try {
      const { data: priorLogs, error: priorLogError } = await db
        .from("notification_logs")
        .select("subscription_id,success,status_code")
        .eq("outbox_id", item.id)
        .not("subscription_id", "is", null);
      if (priorLogError) {
        throw new Error("Unable to read prior delivery records: " + priorLogError.message);
      }

      const successfulIds = new Set(
        (priorLogs ?? [])
          .filter((row: { success: boolean }) => row.success)
          .map((row: { subscription_id: string }) => row.subscription_id),
      );
      const priorFailures = (priorLogs ?? []).filter(
        (row: { subscription_id: string; success: boolean }) =>
          !row.success && !successfulIds.has(row.subscription_id),
      );

      let parentIds: string[] = [];

      if (item.target_type === "all_parents" || item.target_type === "broadcast") {
        const { data, error } = await db
          .from("parent_profiles")
          .select("user_id")
          .eq("disabled", false);
        if (error) throw new Error("Parent audience lookup failed: " + error.message);
        parentIds = (data ?? []).map((row: { user_id: string }) => row.user_id);
      } else if (item.target_type === "single_parent") {
        let candidateIds: string[] = [];
        if (item.target_parent_id) {
          candidateIds = [item.target_parent_id];
        } else if (item.target_child_id) {
          const { data, error } = await db
            .from("parent_children")
            .select("parent_id")
            .eq("child_id", item.target_child_id);
          if (error) throw new Error("Child parent lookup failed: " + error.message);
          candidateIds = (data ?? []).map((row: { parent_id: string }) => row.parent_id);
        }
        if (candidateIds.length) {
          const { data: activeParents, error: activeErr } = await db
            .from("parent_profiles")
            .select("user_id")
            .in("user_id", [...new Set(candidateIds)])
            .eq("disabled", false);
          if (activeErr) throw new Error("Active parent check failed: " + activeErr.message);
          parentIds = (activeParents ?? []).map((row: { user_id: string }) => row.user_id);
        }
      } else if (item.target_type === "section_parents" && item.target_section_id) {
        const { data: children, error: childError } = await db
          .from("children")
          .select("id")
          .eq("section_id", item.target_section_id);
        if (childError) throw new Error("Section children lookup failed: " + childError.message);
        const childIds = (children ?? []).map((row: { id: string }) => row.id);
        if (childIds.length) {
          const { data: links, error: linkErr } = await db
            .from("parent_children")
            .select("parent_id")
            .in("child_id", childIds);
          if (linkErr) throw new Error("Section parent lookup failed: " + linkErr.message);
          const candidateIds = [...new Set((links ?? []).map((row: { parent_id: string }) => row.parent_id))];
          if (candidateIds.length) {
            const { data: activeParents, error: activeErr } = await db
              .from("parent_profiles")
              .select("user_id")
              .in("user_id", candidateIds)
              .eq("disabled", false);
            if (activeErr) throw new Error("Section active parent check failed: " + activeErr.message);
            parentIds = (activeParents ?? []).map((row: { user_id: string }) => row.user_id);
          }
        }
      } else {
        throw new Error("Unsupported notification target type");
      }

      parentIds = [...new Set(parentIds)];
      let subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = [];
      if (parentIds.length) {
        const { data, error } = await db
          .from("push_subscriptions")
          .select("id,endpoint,p256dh,auth")
          .in("parent_user_id", parentIds)
          .eq("is_active", true)
          .eq("role", "parent");
        if (error) throw new Error("Subscription lookup failed: " + error.message);
        subscriptions = data ?? [];
      }

      log("recipients", item.id, corrId, {
        parents: parentIds.length,
        active_subscriptions: subscriptions.length,
        already_accepted: successfulIds.size,
      });

      const remaining = subscriptions.filter((sub) => !successfulIds.has(sub.id));
      if (!remaining.length) {
        if (successfulIds.size && priorFailures.length === 0) {
          await db
            .from("notification_outbox")
            .update({
              status: "sent",
              processing_started_at: null,
              sent_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("id", item.id);
          sent += successfulIds.size;
          log("finalized", item.id, corrId, { status: "sent", accepted: successfulIds.size });
        } else if (priorFailures.length) {
          const finalStatus = successfulIds.size > 0 ? "partially_failed" : "expired";
          await db
            .from("notification_outbox")
            .update({
              status: finalStatus,
              processing_started_at: null,
              retry_count: 5,
              sent_at: successfulIds.size > 0 ? new Date().toISOString() : null,
              error_message:
                successfulIds.size +
                " accepted; " +
                priorFailures.length +
                " recipient(s) permanently failed or expired",
            })
            .eq("id", item.id);
          sent += successfulIds.size;
          failed += priorFailures.length;
          log("finalized", item.id, corrId, {
            status: finalStatus,
            accepted: successfulIds.size,
            permanent_failures: priorFailures.length,
          });
        } else {
          const nextRetry = Math.min(5, (item.retry_count ?? 0) + 1);
          await db
            .from("notification_outbox")
            .update({
              status: "expired",
              processing_started_at: null,
              retry_count: nextRetry,
              error_message: "No active push subscriptions for target",
            })
            .eq("id", item.id);
          failed++;
          log("finalized", item.id, corrId, {
            status: "expired",
            reason: "no_active_subscriptions",
            retry_count: nextRetry,
          });
        }
        processed++;
        continue;
      }

      const targetUrl = item.url || "./parent.html";
      const payload = JSON.stringify({
        title: item.title || "دار الإحسان",
        body: item.body || "لديك إشعار جديد في فضاء الأولياء",
        icon: "./icon-192.png",
        badge: "./logo-sq.png",
        url: targetUrl,
        tag: item.tag || item.id,
        requireInteraction: true,
        data: {
          url: targetUrl,
          outboxId: item.id,
          correlationId: corrId,
          eventType: item.event_type,
        },
      });

      log("sending", item.id, corrId, { target_devices: remaining.length });

      let itemSent = successfulIds.size;
      let transientFailures = 0;
      let permanentFailures = 0;
      let expiredFailures = 0;
      let attemptedFailures = 0;

      for (let i = 0; i < remaining.length; i += SEND_BATCH_SIZE) {
        const chunk = remaining.slice(i, i + SEND_BATCH_SIZE);
        const results = await Promise.allSettled(
          chunk.map(async (sub) => {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
                { TTL: 86400, urgency: "high" },
              );
              return { ok: true as const, sub };
            } catch (err) {
              return { ok: false as const, sub, err };
            }
          }),
        );

        for (const r of results) {
          if (r.status !== "fulfilled") continue;
          const res = r.value;
          if (res.ok) {
            itemSent++;
            await db.from("notification_logs").insert({
              outbox_id: item.id,
              correlation_id: corrId,
              subscription_id: res.sub.id,
              endpoint: res.sub.endpoint,
              status_code: 201,
              response_body: "Push accepted by push service",
              success: true,
              error_type: null,
            });
            log("push_accepted", item.id, corrId, {
              subscription_id: res.sub.id,
              status_code: 201,
            });
          } else {
            attemptedFailures++;
            const e = res.err as { statusCode?: number; body?: string; message?: string };
            const status = Number(e.statusCode) || null;
            const message = String(e.body || e.message || "Push delivery failed").slice(0, 800);
            const transient = !status || status === 408 || status === 429 || status >= 500;
            if (transient) transientFailures++;
            else {
              permanentFailures++;
              if (status === 404 || status === 410) expiredFailures++;
            }

            await db.from("notification_logs").insert({
              outbox_id: item.id,
              correlation_id: corrId,
              subscription_id: res.sub.id,
              endpoint: res.sub.endpoint,
              status_code: status,
              response_body: message,
              success: false,
              error_type: transient ? "transient" : (status === 404 || status === 410 ? "expired" : "permanent"),
            });

            if ([401, 403, 404, 410].includes(status || 0)) {
              await db
                .from("push_subscriptions")
                .update({ is_active: false })
                .eq("id", res.sub.id);
            }
            log("push_rejected", item.id, corrId, {
              subscription_id: res.sub.id,
              status_code: status,
              error_type: transient ? "transient" : "permanent",
              will_retry: transient,
            });
          }
        }
      }

      if (attemptedFailures === 0) {
        await db
          .from("notification_outbox")
          .update({
            status: "sent",
            processing_started_at: null,
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", item.id);
        sent += remaining.length;
        log("finalized", item.id, corrId, { status: "sent", accepted: itemSent });
      } else if (transientFailures === 0 || (item.retry_count ?? 0) >= 4) {
        const finalStatus =
          itemSent > 0
            ? "partially_failed"
            : expiredFailures === attemptedFailures
              ? "expired"
              : "failed";
        await db
          .from("notification_outbox")
          .update({
            status: finalStatus,
            processing_started_at: null,
            retry_count: 5,
            sent_at: itemSent > 0 ? new Date().toISOString() : null,
            error_message:
              itemSent +
              " accepted, " +
              attemptedFailures +
              " failed (" +
              permanentFailures +
              " permanent); inactive subscriptions require renewal",
          })
          .eq("id", item.id);
        sent += itemSent - successfulIds.size;
        failed += attemptedFailures;
        log("finalized", item.id, corrId, {
          status: finalStatus,
          accepted: itemSent,
          failed: attemptedFailures,
          permanent: permanentFailures,
        });
      } else {
        const nextRetry = (item.retry_count ?? 0) + 1;
        await db
          .from("notification_outbox")
          .update({
            status: "failed",
            processing_started_at: null,
            retry_count: nextRetry,
            sent_at: null,
            error_message:
              itemSent +
              " accepted, " +
              transientFailures +
              " temporary failures; successful recipients will be skipped on retry",
          })
          .eq("id", item.id);
        sent += itemSent - successfulIds.size;
        failed += transientFailures;
        log("finalized", item.id, corrId, {
          status: "failed",
          reason: "transient",
          accepted: itemSent,
          transient_failures: transientFailures,
          retry_count: nextRetry,
        });
      }
      processed++;
    } catch (err) {
      const message = String((err as { message?: string })?.message || "Unexpected push worker error").slice(0, 800);
      await db
        .from("notification_outbox")
        .update({
          status: "failed",
          processing_started_at: null,
          retry_count: Math.min(5, (item.retry_count ?? 0) + 1),
          error_message: message,
        })
        .eq("id", item.id);
      log("worker_error", item.id, corrId, { message });
      failed++;
      processed++;
    }
  }

  return json(200, { ok: true, processed, sent, failed, skipped, protectedBefore: SAFE_OUTBOX_START });
});
