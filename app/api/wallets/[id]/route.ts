import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { walletUpdateSchema } from "@/lib/validation/settings";
import { formatNumberFr } from "@/lib/audit";
import { prepareActivity, type ActivityItem } from "@/lib/activity";
import { jsonOk } from "@/lib/serialize";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = walletUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const before = await prisma.wallet.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const d = parsed.data;
  const nextLogo = d.logoUrl === undefined ? undefined : d.logoUrl || null;
  const nextOwner = d.ownerId === undefined ? undefined : d.ownerId || null;
  const name = d.name ?? before.name;

  const nextCurrency = d.currencyCode !== undefined && d.currencyCode !== before.currencyCode ? d.currencyCode : null;
  if (nextCurrency) {
    const known = await prisma.currency.findUnique({ where: { code: nextCurrency }, select: { code: true } });
    if (!known) return NextResponse.json({ error: "Devise inconnue." }, { status: 400 });
  }

  // Owner ids -> names, so the audit line reads "Propriétaire : Admin → Dolin".
  const ownerIds = [before.ownerId, nextOwner].filter((v): v is string => Boolean(v));
  const owners = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
    : [];
  const ownerName = (userId: string | null | undefined) =>
    userId ? (owners.find((o) => o.id === userId)?.name ?? "—") : "aucun";

  const parts: string[] = [];
  if (d.name !== undefined && d.name !== before.name) parts.push(`Nom : ${before.name} → ${d.name}`);
  if (nextCurrency) parts.push(`Devise : ${before.currencyCode} → ${nextCurrency} (montants inchangés, sans conversion)`);
  if (d.icon !== undefined && d.icon !== before.icon) parts.push("Icône modifiée");
  if (nextLogo !== undefined && nextLogo !== before.logoUrl) {
    parts.push(nextLogo ? (before.logoUrl ? "Logo remplacé" : "Logo ajouté") : "Logo retiré");
  }
  if (nextOwner !== undefined && nextOwner !== before.ownerId) {
    parts.push(`Propriétaire : ${ownerName(before.ownerId)} → ${ownerName(nextOwner)}`);
  }
  if (d.isSource !== undefined && d.isSource !== before.isSource) {
    parts.push(`Source de gains : ${d.isSource ? "oui" : "non"}`);
  }
  if (d.commissionPercent !== undefined && d.commissionPercent !== before.commissionPercent) {
    parts.push(`Commission : ${formatNumberFr(before.commissionPercent)} % → ${formatNumberFr(d.commissionPercent)} %`);
  }

  const items: ActivityItem[] = [];
  if (parts.length > 0) {
    items.push({
      actor: auth,
      audit: { action: "wallet.updated", entityType: "Wallet", entityId: id, phrase: `a modifié le compte ${name}`, details: parts.join(" · ") },
      title: "Compte modifié",
    });
  }
  if (d.archived !== undefined && d.archived !== before.archived) {
    items.push({
      actor: auth,
      audit: {
        action: d.archived ? "wallet.archived" : "wallet.restored",
        entityType: "Wallet",
        entityId: id,
        phrase: `a ${d.archived ? "archivé" : "réactivé"} le compte ${name}`,
      },
      title: d.archived ? "Compte archivé" : "Compte réactivé",
    });
  }
  const activity = await prepareActivity(items);

  const update = prisma.wallet.update({
    where: { id },
    data: { ...d, logoUrl: nextLogo, ownerId: nextOwner },
  });
  // Every gain, expense and transfer carries the currency of its account: they are relabelled in the same
  // transaction, amounts untouched (this corrects a wrong currency, it does not convert), so totals stay coherent.
  const relabel = nextCurrency
    ? [
        prisma.gain.updateMany({ where: { walletId: id }, data: { currencyCode: nextCurrency } }),
        prisma.expense.updateMany({ where: { walletId: id }, data: { currencyCode: nextCurrency } }),
        prisma.transfer.updateMany({ where: { fromWalletId: id }, data: { fromCurrencyCode: nextCurrency } }),
        prisma.transfer.updateMany({ where: { toWalletId: id }, data: { toCurrencyCode: nextCurrency } }),
      ]
    : [];
  const results = await prisma.$transaction([update, ...relabel, ...activity.ops]);
  activity.deliver();
  const wallet = results[0] as Awaited<typeof update>;

  return jsonOk({ wallet });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const before = await prisma.wallet.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  const update = prisma.wallet.update({ where: { id }, data: { archived: true } });
  const activity = await prepareActivity(
    before.archived
      ? []
      : [
          {
            actor: auth,
            audit: { action: "wallet.archived", entityType: "Wallet", entityId: id, phrase: `a archivé le compte ${before.name}` },
            title: "Compte archivé",
          },
        ]
  );
  const results = await prisma.$transaction([update, ...activity.ops]);
  activity.deliver();
  const wallet = results[0] as Awaited<typeof update>;

  return jsonOk({ wallet });
}
