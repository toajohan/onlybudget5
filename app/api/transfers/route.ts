import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { transferCreateSchema } from "@/lib/validation/ledger";
import { formatMajor, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { prepareActivity } from "@/lib/activity";
import { computeTransfer } from "@/lib/fees";
import { jsonOk } from "@/lib/serialize";

export async function POST(request: Request) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const body = await request.json().catch(() => null);
  const parsed = transferCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const { fromWalletId, toWalletId, amountMajor, note } = parsed.data;
  if (fromWalletId === toWalletId) {
    return NextResponse.json({ error: "Le compte source et destination doivent être différents." }, { status: 400 });
  }

  const [fromWallet, toWallet, route, currencies] = await Promise.all([
    prisma.wallet.findUnique({ where: { id: fromWalletId } }),
    prisma.wallet.findUnique({ where: { id: toWalletId } }),
    prisma.walletRoute.findUnique({ where: { fromWalletId_toWalletId: { fromWalletId, toWalletId } } }),
    prisma.currency.findMany(),
  ]);

  if (!fromWallet || fromWallet.archived) return NextResponse.json({ error: "Compte source invalide." }, { status: 400 });
  if (!toWallet || toWallet.archived) return NextResponse.json({ error: "Compte destination invalide." }, { status: 400 });
  if (!route || route.archived) {
    return NextResponse.json({ error: "Aucun chemin de retrait configuré entre ces deux comptes." }, { status: 400 });
  }

  const amountSentMinor = Number(toMinorUnits(amountMajor));
  const computation = computeTransfer(route, amountSentMinor, fromWallet.currencyCode, toWallet.currencyCode, currencies);

  const feeText = computation.feeAmountMinor > 0 ? `, frais ${formatMajor(toMajorUnits(computation.feeAmountMinor), fromWallet.currencyCode)}` : "";
  const activity = await prepareActivity([
    {
      actor: user,
      kind: "transfer.created",
      title: "Nouveau retrait",
      body: `${user.name} a retiré ${formatMajor(toMajorUnits(amountSentMinor), fromWallet.currencyCode)} de ${fromWallet.name} vers ${toWallet.name}${feeText}`,
      url: "/historique",
    },
  ]);

  // Array (batch) form, not the interactive callback form — the latter needs a held-open
  // session and breaks under Neon's pooled/pgbouncer-style connection (P2028 errors).
  const [transfer] = await prisma.$transaction([
    prisma.transfer.create({
      data: {
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        fromCurrencyCode: fromWallet.currencyCode,
        toCurrencyCode: toWallet.currencyCode,
        amountSentMinor,
        feeAmountMinor: computation.feeAmountMinor,
        exchangeRateUsed: computation.exchangeRateUsed,
        amountReceivedMinor: computation.amountReceivedMinor,
        note: note || null,
        createdById: user.id,
      },
    }),
    prisma.wallet.update({ where: { id: fromWallet.id }, data: { balanceMinor: { decrement: amountSentMinor } } }),
    prisma.wallet.update({ where: { id: toWallet.id }, data: { balanceMinor: { increment: computation.amountReceivedMinor } } }),
    ...activity.ops,
  ]);
  activity.deliver();

  return jsonOk({ transfer }, { status: 201 });
}
