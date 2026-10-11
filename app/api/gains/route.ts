import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { gainCreateSchema } from "@/lib/validation/ledger";
import { formatMajor, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { applyCommission } from "@/lib/commission";
import { formatNumberFr } from "@/lib/audit";
import { prepareActivity } from "@/lib/activity";
import { jsonOk } from "@/lib/serialize";

/** A chatteur's own gains, or every gain for an associate — latest 100, same shape as the web gains page. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const isAssociate = auth.role === "ASSOCIE";

  const gains = await prisma.gain.findMany({
    where: isAssociate ? undefined : { chatterId: auth.id },
    include: { chatter: true, wallet: true, createdBy: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return jsonOk({
    gains: gains.map((g) => ({
      id: g.id,
      date: g.date,
      amountMinor: g.amountMinor,
      grossAmountMinor: g.grossAmountMinor,
      commissionPercent: g.commissionPercent,
      currencyCode: g.currencyCode,
      chatterId: g.chatterId,
      chatterName: g.chatter.name,
      walletId: g.walletId,
      walletName: g.wallet.name,
      walletIcon: g.wallet.icon,
      note: g.note,
      createdByName: g.createdBy.name,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const body = await request.json().catch(() => null);
  const parsed = gainCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  if (user.role === "CHATTEUR" && parsed.data.chatterId !== user.id) {
    return NextResponse.json({ error: "Vous ne pouvez ajouter que vos propres gains." }, { status: 403 });
  }

  const chatter = await prisma.user.findUnique({ where: { id: parsed.data.chatterId } });
  if (!chatter || !chatter.active) return NextResponse.json({ error: "Utilisateur invalide." }, { status: 400 });

  const wallet = await prisma.wallet.findUnique({ where: { id: parsed.data.walletId } });
  if (!wallet || wallet.archived) return NextResponse.json({ error: "Compte invalide." }, { status: 400 });
  if (!wallet.isSource) {
    return NextResponse.json({ error: "Ce compte n'accepte pas de gains directs." }, { status: 400 });
  }

  // The amount typed is the gross one; the platform's commission (15 % on Wysper) is taken off automatically
  // and only the rest is our gain: that net amount is what every total and balance uses.
  const grossMinor = Number(toMinorUnits(parsed.data.amountMajor));
  const { commissionMinor, netMinor, percent } = applyCommission(grossMinor, wallet.commissionPercent);

  const money = (minor: number) => formatMajor(toMajorUnits(minor), wallet.currencyCode);
  const forSomeoneElse = chatter.id !== user.id;
  const activity = await prepareActivity([
    {
      actor: user,
      kind: "gain.created",
      title: "Nouveau gain",
      body:
        `${user.name} a ajouté un gain de ${money(netMinor)} sur ${wallet.name}` +
        (forSomeoneElse ? ` pour ${chatter.name}` : "") +
        (commissionMinor > 0 ? ` (${money(grossMinor)} − ${formatNumberFr(percent)} % de commission)` : ""),
      url: "/gains",
      alsoUserIds: [chatter.id],
    },
  ]);

  // Array (batch) form, not the interactive callback form — the latter needs a held-open
  // session and breaks under Neon's pooled/pgbouncer-style connection (P2028 errors).
  const [gain] = await prisma.$transaction([
    prisma.gain.create({
      data: {
        chatterId: chatter.id,
        walletId: wallet.id,
        amountMinor: BigInt(netMinor),
        grossAmountMinor: BigInt(grossMinor),
        commissionPercent: percent,
        currencyCode: wallet.currencyCode,
        date: new Date(parsed.data.date),
        note: parsed.data.note || null,
        createdById: user.id,
      },
    }),
    prisma.wallet.update({ where: { id: wallet.id }, data: { balanceMinor: { increment: BigInt(netMinor) } } }),
    ...activity.ops,
  ]);
  activity.deliver();

  return jsonOk({ gain }, { status: 201 });
}
