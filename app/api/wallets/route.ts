import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie, requireApiUser } from "@/lib/api-auth";
import { walletCreateSchema } from "@/lib/validation/settings";
import { formatMajor, toMinorUnits } from "@/lib/currency";
import { formatNumberFr } from "@/lib/audit";
import { prepareActivity } from "@/lib/activity";
import { jsonOk } from "@/lib/serialize";

/** A chatteur only needs the accounts they can log a gain into; an associate manages every account (balances included). */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  if (auth.role !== "ASSOCIE") {
    const wallets = await prisma.wallet.findMany({
      where: { isSource: true, archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, icon: true, logoUrl: true, currencyCode: true, isSource: true, commissionPercent: true },
    });
    return jsonOk({ wallets });
  }

  const wallets = await prisma.wallet.findMany({ orderBy: [{ archived: "asc" }, { name: "asc" }] });
  return jsonOk({ wallets });
}

export async function POST(request: Request) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = walletCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const currency = await prisma.currency.findUnique({ where: { code: parsed.data.currencyCode } });
  if (!currency) return NextResponse.json({ error: "Devise inconnue." }, { status: 400 });

  const initial = parsed.data.initialBalanceMajor;

  const activity = await prepareActivity([
    {
      actor: auth,
      audit: {
        action: "wallet.created",
        entityType: "Wallet",
        phrase: `a créé le compte ${parsed.data.name}`,
        details: [
          parsed.data.currencyCode,
          parsed.data.isSource ? "source de gains" : null,
          parsed.data.commissionPercent > 0 ? `commission ${formatNumberFr(parsed.data.commissionPercent)} %` : null,
          initial > 0 ? `solde initial ${formatMajor(initial, parsed.data.currencyCode)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
      title: "Nouveau compte",
    },
  ]);

  const [wallet] = await prisma.$transaction([
    prisma.wallet.create({
      data: {
        name: parsed.data.name,
        icon: parsed.data.icon,
        logoUrl: parsed.data.logoUrl || null,
        currencyCode: parsed.data.currencyCode,
        ownerId: parsed.data.ownerId || null,
        isSource: parsed.data.isSource,
        commissionPercent: parsed.data.commissionPercent,
        balanceMinor: toMinorUnits(initial),
      },
    }),
    ...activity.ops,
  ]);
  activity.deliver();

  return jsonOk({ wallet }, { status: 201 });
}
