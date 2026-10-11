import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";

const tokenSchema = z.object({ token: z.string().min(1) });

/** Registers this device (the Flutter app) for Firebase Cloud Messaging — the mobile equivalent of /api/push/subscribe. */
export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const parsed = tokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Jeton invalide." }, { status: 400 });

  await prisma.fcmToken.upsert({
    where: { token: parsed.data.token },
    update: { userId: auth.id },
    create: { userId: auth.id, token: parsed.data.token },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Stops FCM notifications on this device (e.g. on logout). */
export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const parsed = tokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });

  await prisma.fcmToken.deleteMany({ where: { token: parsed.data.token, userId: auth.id } });
  return NextResponse.json({ ok: true });
}
