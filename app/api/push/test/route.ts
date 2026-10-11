import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { pushIsConfigured, sendPushToUsers } from "@/lib/push";
import { fcmIsConfigured } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";

/** Sends a test system notification to the signed-in user's registered devices (web push and/or FCM/mobile). */
export async function POST() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  // Web push (VAPID) and FCM (mobile) are independent: this only needs one of the two configured.
  if (!pushIsConfigured() && !fcmIsConfigured()) {
    return NextResponse.json({ error: "Les notifications système ne sont pas configurées sur le serveur." }, { status: 503 });
  }

  // Looks exactly like a real new-gain notification, on a real platform's logo when one is set.
  const wallet = await prisma.wallet.findFirst({
    where: { isSource: true, archived: false, logoUrl: { not: null } },
    select: { name: true, logoUrl: true },
  });
  const result = await sendPushToUsers([auth.id], {
    title: `🤑 +100,00 $ sur ${wallet?.name ?? "OnlyChat"}`,
    body: "Test : voilà ce que vous verrez à chaque nouvelle vente 💸",
    url: "/dashboard",
    tag: "test",
    imageUrl: wallet?.logoUrl ?? undefined,
  });
  return NextResponse.json(result);
}
