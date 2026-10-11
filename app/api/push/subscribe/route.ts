import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** Registers this browser/device for system notifications (the same device can only belong to one user at a time). */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });

  const { endpoint, keys } = parsed.data;
  const userAgent = request.headers.get("user-agent")?.slice(0, 200) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: auth.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    create: { userId: auth.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Stops system notifications on this device. */
export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const parsed = z.object({ endpoint: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });

  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: auth.id } });
  return NextResponse.json({ ok: true });
}
