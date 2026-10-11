import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { pushIsConfigured, sendPushToUsers } from "@/lib/push";
import { fcmIsConfigured } from "@/lib/firebase-admin";

/** Sends a test system notification to the signed-in user's registered devices (web push and/or FCM/mobile). */
export async function POST() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  // Web push (VAPID) and FCM (mobile) are independent: this only needs one of the two configured.
  if (!pushIsConfigured() && !fcmIsConfigured()) {
    return NextResponse.json({ error: "Les notifications système ne sont pas configurées sur le serveur." }, { status: 503 });
  }

  const result = await sendPushToUsers([auth.id], {
    title: "OnlyBudget",
    body: "Test réussi : les notifications fonctionnent sur cet appareil.",
    url: "/dashboard",
    tag: "test",
  });
  return NextResponse.json(result);
}
