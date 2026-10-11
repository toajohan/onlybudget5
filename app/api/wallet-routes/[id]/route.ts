import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { prepareActivity } from "@/lib/activity";
import { jsonOk } from "@/lib/serialize";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const before = await prisma.walletRoute.findUnique({ where: { id }, include: { fromWallet: true, toWallet: true } });
  if (!before) return NextResponse.json({ error: "Chemin introuvable." }, { status: 404 });

  const update = prisma.walletRoute.update({ where: { id }, data: { archived: true } });
  const activity = await prepareActivity(
    before.archived
      ? []
      : [
          {
            actor: auth,
            audit: {
              action: "route.archived",
              entityType: "WalletRoute",
              entityId: id,
              phrase: `a supprimé le chemin ${before.fromWallet.name} → ${before.toWallet.name}`,
            },
            title: "Chemin de retrait supprimé",
          },
        ]
  );
  const results = await prisma.$transaction([update, ...activity.ops]);
  activity.deliver();
  const route = results[0] as Awaited<typeof update>;

  return jsonOk({ route });
}
