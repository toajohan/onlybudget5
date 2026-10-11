import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { walletRouteSchema } from "@/lib/validation/settings";
import { toMinorUnits } from "@/lib/currency";
import { describeFee } from "@/lib/audit";
import { prepareActivity } from "@/lib/activity";
import { jsonOk } from "@/lib/serialize";

export async function POST(request: Request) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = walletRouteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const { fromWalletId, toWalletId, feeType, feePercent, feeFixedMajor } = parsed.data;

  const [existing, wallets] = await Promise.all([
    prisma.walletRoute.findUnique({ where: { fromWalletId_toWalletId: { fromWalletId, toWalletId } } }),
    prisma.wallet.findMany({ where: { id: { in: [fromWalletId, toWalletId] } } }),
  ]);
  const from = wallets.find((w) => w.id === fromWalletId);
  const to = wallets.find((w) => w.id === toWalletId);
  if (!from || !to) return NextResponse.json({ error: "Compte introuvable." }, { status: 400 });

  const feeFixedMinor = feeType === "FIXED" ? toMinorUnits(feeFixedMajor ?? 0) : null;
  const feePercentValue = feeType === "PERCENT" ? (feePercent ?? 0) : null;

  const wasActive = Boolean(existing && !existing.archived);
  const newFee = describeFee(feeType, feePercentValue, feeFixedMinor, from.currencyCode);
  const oldFee = existing && wasActive ? describeFee(existing.feeType, existing.feePercent, existing.feeFixedMinor, from.currencyCode) : null;

  const upsert = prisma.walletRoute.upsert({
    where: { fromWalletId_toWalletId: { fromWalletId, toWalletId } },
    update: { feeType, feePercent: feePercentValue, feeFixedMinor, archived: false },
    create: { fromWalletId, toWalletId, feeType, feePercent: feePercentValue, feeFixedMinor },
  });

  // Re-saving identical fees is not a modification: nothing to log.
  const activity = await prepareActivity(
    wasActive && oldFee === newFee
      ? []
      : [
          {
            actor: auth,
            audit: {
              action: wasActive ? "route.updated" : "route.created",
              entityType: "WalletRoute",
              entityId: existing?.id,
              phrase: `a ${wasActive ? "modifié" : "créé"} le chemin ${from.name} → ${to.name}`,
              details: oldFee ? `Frais : ${oldFee} → ${newFee}` : `Frais : ${newFee}`,
            },
            title: wasActive ? "Chemin de retrait modifié" : "Nouveau chemin de retrait",
          },
        ]
  );

  const results = await prisma.$transaction([upsert, ...activity.ops]);
  activity.deliver();
  const route = results[0] as Awaited<typeof upsert>;

  return jsonOk({ route }, { status: 201 });
}
