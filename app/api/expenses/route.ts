import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { expenseCreateSchema } from "@/lib/validation/ledger";
import { formatMajor, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { prepareActivity } from "@/lib/activity";
import { jsonOk } from "@/lib/serialize";

/** Every expense, latest 100 — same shape as the web expenses page. Associates only. */
export async function GET() {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const expenses = await prisma.expense.findMany({
    include: { category: true, wallet: true, createdBy: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return jsonOk({
    expenses: expenses.map((e) => ({
      id: e.id,
      date: e.date,
      amountMinor: e.amountMinor,
      currencyCode: e.currencyCode,
      categoryId: e.categoryId,
      categoryName: e.category.name,
      categoryIcon: e.category.icon,
      walletId: e.walletId,
      walletName: e.wallet.name,
      note: e.note,
      createdByName: e.createdBy.name,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const body = await request.json().catch(() => null);
  const parsed = expenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const [category, wallet] = await Promise.all([
    prisma.expenseCategory.findUnique({ where: { id: parsed.data.categoryId } }),
    prisma.wallet.findUnique({ where: { id: parsed.data.walletId } }),
  ]);
  if (!category || category.archived) return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
  if (!wallet || wallet.archived) return NextResponse.json({ error: "Compte invalide." }, { status: 400 });

  const amountMinor = toMinorUnits(parsed.data.amountMajor);

  const activity = await prepareActivity([
    {
      actor: user,
      kind: "expense.created",
      title: "Nouvelle dépense",
      body: `${user.name} a ajouté une dépense de ${formatMajor(toMajorUnits(amountMinor), wallet.currencyCode)} (${category.name}) depuis ${wallet.name}`,
      url: "/depenses",
    },
  ]);

  // Array (batch) form, not the interactive callback form — the latter needs a held-open
  // session and breaks under Neon's pooled/pgbouncer-style connection (P2028 errors).
  const [expense] = await prisma.$transaction([
    prisma.expense.create({
      data: {
        categoryId: category.id,
        walletId: wallet.id,
        amountMinor,
        currencyCode: wallet.currencyCode,
        date: new Date(parsed.data.date),
        note: parsed.data.note || null,
        createdById: user.id,
      },
    }),
    prisma.wallet.update({ where: { id: wallet.id }, data: { balanceMinor: { decrement: amountMinor } } }),
    ...activity.ops,
  ]);
  activity.deliver();

  return jsonOk({ expense }, { status: 201 });
}
