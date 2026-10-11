import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { gainCreateSchema } from "@/lib/validation/ledger";
import { formatMajor, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { applyCommission } from "@/lib/commission";
import { formatDate } from "@/lib/date";
import { prepareActivity } from "@/lib/activity";
import { jsonOk } from "@/lib/serialize";

const money = (minor: bigint | number, code: string) => formatMajor(toMajorUnits(minor), code);

/** Edits a gain: balances, totals and the net profit follow automatically (they are computed from the ledger). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = gainCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const before = await prisma.gain.findUnique({ where: { id }, include: { wallet: true, chatter: true } });
  if (!before) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const [chatter, wallet] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsed.data.chatterId } }),
    prisma.wallet.findUnique({ where: { id: parsed.data.walletId } }),
  ]);
  if (!chatter || (!chatter.active && chatter.id !== before.chatterId)) {
    return NextResponse.json({ error: "Utilisateur invalide." }, { status: 400 });
  }
  if (!wallet) return NextResponse.json({ error: "Compte invalide." }, { status: 400 });
  const walletChanged = wallet.id !== before.walletId;
  if (walletChanged && (wallet.archived || !wallet.isSource)) {
    return NextResponse.json({ error: "Ce compte n'accepte pas de gains directs." }, { status: 400 });
  }

  const grossMinor = Number(toMinorUnits(parsed.data.amountMajor));
  const previousGross = Number(before.grossAmountMinor ?? before.amountMinor);

  // Same wallet and same typed amount on a gain that already went through a commission: keep it exactly as it was
  // (editing a note must not silently re-price an old gain if the wallet's rate changed since).
  // Otherwise the wallet's current commission applies to the amount typed, like for a new gain.
  const keepAmounts = !walletChanged && before.grossAmountMinor !== null && grossMinor === previousGross;
  const netMinor = keepAmounts ? Number(before.amountMinor) : applyCommission(grossMinor, wallet.commissionPercent).netMinor;
  const percent = keepAmounts ? (before.commissionPercent ?? 0) : applyCommission(grossMinor, wallet.commissionPercent).percent;
  const newDate = new Date(parsed.data.date);
  const newNote = parsed.data.note || null;

  const parts: string[] = [];
  if (grossMinor !== previousGross || walletChanged) {
    parts.push(`Montant : ${money(previousGross, before.currencyCode)} → ${money(grossMinor, wallet.currencyCode)}`);
  }
  if (netMinor !== Number(before.amountMinor) && (percent > 0 || (before.commissionPercent ?? 0) > 0)) {
    parts.push(`Gain net : ${money(before.amountMinor, before.currencyCode)} → ${money(netMinor, wallet.currencyCode)}`);
  }
  if (walletChanged) parts.push(`Compte : ${before.wallet.name} → ${wallet.name}`);
  if (chatter.id !== before.chatterId) parts.push(`Chatteur : ${before.chatter.name} → ${chatter.name}`);
  if (newDate.getTime() !== before.date.getTime()) parts.push(`Date : ${formatDate(before.date)} → ${formatDate(newDate)}`);
  if (newNote !== before.note) parts.push("Note modifiée");

  // Nothing actually changed: no update, no audit line, no notification.
  if (parts.length === 0) return jsonOk({ gain: before });

  const what = `le gain de ${chatter.name} sur ${wallet.name}`;
  const activity = await prepareActivity([
    {
      actor: user,
      audit: {
        action: "gain.updated",
        entityType: "Gain",
        entityId: id,
        phrase: `a modifié ${what}`,
        details: parts.join(" · "),
      },
      title: "Gain modifié",
      body: `${user.name} a modifié ${what} — ${parts.join(" · ")}`,
      url: "/gains",
      alsoUserIds: [before.chatterId, chatter.id],
    },
  ]);

  const oldNet = before.amountMinor;
  const newNet = BigInt(netMinor);
  const balanceOps = walletChanged
    ? [
        prisma.wallet.update({ where: { id: before.walletId }, data: { balanceMinor: { decrement: oldNet } } }),
        prisma.wallet.update({ where: { id: wallet.id }, data: { balanceMinor: { increment: newNet } } }),
      ]
    : [prisma.wallet.update({ where: { id: wallet.id }, data: { balanceMinor: { increment: newNet - oldNet } } })];

  const results = await prisma.$transaction([
    prisma.gain.update({
      where: { id },
      data: {
        chatterId: chatter.id,
        walletId: wallet.id,
        amountMinor: newNet,
        grossAmountMinor: BigInt(grossMinor),
        commissionPercent: percent,
        currencyCode: wallet.currencyCode,
        date: newDate,
        note: newNote,
      },
    }),
    ...balanceOps,
    ...activity.ops,
  ]);
  activity.deliver();

  return jsonOk({ gain: results[0] });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await params;
  const gain = await prisma.gain.findUnique({ where: { id }, include: { wallet: true, chatter: true } });
  if (!gain) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const details = [
    money(gain.amountMinor, gain.currencyCode) +
      (gain.grossAmountMinor !== null && (gain.commissionPercent ?? 0) > 0
        ? ` (${money(gain.grossAmountMinor, gain.currencyCode)} avant commission)`
        : ""),
    gain.wallet.name,
    gain.chatter.name,
    formatDate(gain.date),
  ].join(" · ");

  const activity = await prepareActivity([
    {
      actor: user,
      // The gain disappears from the ledger, so its details are kept in the audit trail.
      audit: { action: "gain.deleted", entityType: "Gain", entityId: id, phrase: "a supprimé un gain", details },
      title: "Gain supprimé",
      url: "/gains",
      alsoUserIds: [gain.chatterId],
    },
  ]);

  await prisma.$transaction([
    prisma.wallet.update({ where: { id: gain.walletId }, data: { balanceMinor: { decrement: gain.amountMinor } } }),
    prisma.gain.delete({ where: { id } }),
    ...activity.ops,
  ]);
  activity.deliver();

  return NextResponse.json({ ok: true });
}
