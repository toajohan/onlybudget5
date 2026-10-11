import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";

/** The signed-in user's own notifications, newest first, plus how many are unread. */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const requested = Number(new URL(request.url).searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(requested) ? Math.min(60, Math.max(1, Math.trunc(requested))) : 30;

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId: auth.id }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.notification.count({ where: { userId: auth.id, readAt: null } }),
  ]);

  return NextResponse.json({
    notifications: items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      url: n.url,
      createdAt: n.createdAt.toISOString(),
      read: n.readAt !== null,
    })),
    unreadCount,
  });
}

const markReadSchema = z.object({ ids: z.array(z.string()).max(100).optional(), all: z.boolean().optional() });

/** Marks some (or all) of the signed-in user's notifications as read. */
export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const parsed = markReadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.all && !parsed.data.ids?.length)) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { userId: auth.id, readAt: null, ...(parsed.data.all ? {} : { id: { in: parsed.data.ids } }) },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
