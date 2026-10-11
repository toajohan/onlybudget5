import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { fcmIsConfigured, messaging } from "@/lib/firebase-admin";

export type PushPayload = { title: string; body: string; url?: string; tag?: string; imageUrl?: string };

let vapidConfigured: boolean | null = null;

/** True once both VAPID keys are present in the environment (they are generated once and stored as env vars). */
export function pushIsConfigured(): boolean {
  if (vapidConfigured !== null) return vapidConfigured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    vapidConfigured = false;
    return false;
  }
  // The subject tells the push services who to contact; the site URL is enough (no personal email needed).
  webpush.setVapidDetails("https://onlybudget-app.vercel.app", publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

/** Web Push (VAPID) to every browser that subscribed — the installed PWA / desktop/Android Chrome. Never throws. */
async function sendWebPush(userIds: string[], payload: PushPayload): Promise<{ sent: number; removed: number }> {
  try {
    if (!pushIsConfigured()) return { sent: 0, removed: 0 };

    const [allSubscriptions, appUsers] = await Promise.all([
      prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } }),
      prisma.fcmToken.findMany({ where: { userId: { in: userIds } }, select: { userId: true }, distinct: ["userId"] }),
    ]);
    // Someone with the Android app gets its native notification: their Android browser would only duplicate it.
    const hasApp = new Set(appUsers.map((t) => t.userId));
    const subscriptions = allSubscriptions.filter((s) => !(hasApp.has(s.userId) && /Android/i.test(s.userAgent ?? "")));
    if (subscriptions.length === 0) return { sent: 0, removed: 0 };

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subscriptions.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 60 * 24,
          urgency: "high",
        })
      )
    );

    const gone: string[] = [];
    let sent = 0;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        sent += 1;
        return;
      }
      const status = (result.reason as { statusCode?: number } | undefined)?.statusCode;
      if (status === 404 || status === 410) gone.push(subscriptions[index].id);
    });

    if (gone.length > 0) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
    return { sent, removed: gone.length };
  } catch {
    return { sent: 0, removed: 0 };
  }
}

/**
 * Firebase Cloud Messaging to every registered mobile device (the Flutter app) — data-only payload, so the app
 * decides how to show it (its own local notification + cash-register sound) the same way whether it's in the
 * foreground, backgrounded, or fully closed. Dead/unregistered tokens are removed. Never throws.
 */
async function sendFcmPush(userIds: string[], payload: PushPayload): Promise<{ sent: number; removed: number }> {
  try {
    if (!fcmIsConfigured()) return { sent: 0, removed: 0 };

    const tokens = await prisma.fcmToken.findMany({ where: { userId: { in: userIds } } });
    if (tokens.length === 0) return { sent: 0, removed: 0 };

    const data = {
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "",
      tag: payload.tag ?? "activity",
      imageUrl: payload.imageUrl ?? "",
    };
    const results = await Promise.allSettled(
      tokens.map((t) => messaging().send({ token: t.token, data, android: { priority: "high" as const } }))
    );

    const gone: string[] = [];
    let sent = 0;
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        sent += 1;
        return;
      }
      const code = (result.reason as { code?: string } | undefined)?.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token" || code === "messaging/invalid-argument") {
        gone.push(tokens[index].id);
      }
    });

    if (gone.length > 0) await prisma.fcmToken.deleteMany({ where: { id: { in: gone } } });
    return { sent, removed: gone.length };
  } catch {
    return { sent: 0, removed: 0 };
  }
}

/** Sends a system notification to every device (web + mobile) registered by these users. Never throws. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (userIds.length === 0) return { sent: 0, removed: 0 };
  const [web, fcm] = await Promise.all([sendWebPush(userIds, payload), sendFcmPush(userIds, payload)]);
  return { sent: web.sent + fcm.sent, removed: web.removed + fcm.removed };
}
