import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { expenseCreateSchema } from "@/lib/validation/ledger";
import { formatMajor, toMajorUnits, toMinorUnits } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { prepareActivity } from "@/lib/activity";
import { jsonOk } from "@/lib/serialize";

const money = (minor: bigint | number, code: string) => formatMajor(toMajorUnits(minor), code);

/** Edits an expense: balances, totals and the net profit follow automatically (they are computed from the ledger). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = expenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const before = await prisma.expense.findUnique({ where: { id }, include: { wallet: true, category: true } });
  if (!before) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const [category, wallet] = await Promise.all([
    prisma.expenseCategory.findUnique({ where: { id: parsed.data.categoryId } }),
    prisma.wallet.findUnique({ where: { id: parsed.data.walletId } }),
  ]);
  if (!category || (category.archived && category.id !== before.categoryId)) {
    return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
  }
  if (!wallet || (wallet.archived && wallet.id !== before.walletId)) {
    return NextResponse.json({ error: "Compte invalide." }, { status: 400 });
  }

  const walletChanged = wallet.id !== before.walletId;
  const newAmount = toMinorUnits(parsed.data.amountMajor);
  const newDate = new Date(parsed.data.date);
  const newNote = parsed.data.note || null;

  const parts: string[] = [];
  if (newAmount !== before.amountMinor || walletChanged) {
    parts.push(`Montant : ${money(before.amountMinor, before.currencyCode)} → ${money(newAmount, wallet.currencyCode)}`);
  }
  if (category.id !== before.categoryId) parts.push(`Catégorie : ${before.category.name} → ${category.name}`);
  if (walletChanged) parts.push(`Payé depuis : ${before.wallet.name} → ${wallet.name}`);
  if (newDate.getTime() !== before.date.getTime()) parts.push(`Date : ${formatDate(before.date)} → ${formatDate(newDate)}`);
  if (newNote !== before.note) parts.push("Note modifiée");

  // Nothing actually changed: no update, no audit line, no notification.
  if (parts.length === 0) return jsonOk({ expense: before });

  const what = `la dépense « ${category.name} » (${wallet.name})`;
  const activity = await prepareActivity([
    {
      actor: user,
      audit: { action: "expense.updated", entityType: "Expense", entityId: id, phrase: `a modifié ${what}`, details: parts.join(" · ") },
      title: "Dépense modifiée",
      body: `${user.name} a modifié ${what} — ${parts.join(" · ")}`,
      url: "/depenses",
    },
  ]);

  // An expense takes money out of its wallet: give the old amount back, take the new one.
  const balanceOps = walletChanged
    ? [
        prisma.wallet.update({ where: { id: before.walletId }, data: { balanceMinor: { increment: before.amountMinor } } }),
        prisma.wallet.update({ where: { id: wallet.id }, data: { balanceMinor: { decrement: newAmount } } }),
      ]
    : [prisma.wallet.update({ where: { id: wallet.id }, data: { balanceMinor: { increment: before.amountMinor - newAmount } } })];

  const results = await prisma.$transaction([
    prisma.expense.update({
      where: { id },
      data: {
        categoryId: category.id,
        walletId: wallet.id,
        amountMinor: newAmount,
        currencyCode: wallet.currencyCode,
        date: newDate,
        note: newNote,
      },
    }),
    ...balanceOps,
    ...activity.ops,
  ]);
  activity.deliver();

  return jsonOk({ expense: results[0] });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id }, include: { wallet: true, category: true } });
  if (!expense) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const activity = await prepareActivity([
    {
      actor: user,
      // The expense disappears from the ledger, so its details are kept in the audit trail.
      audit: {
        action: "expense.deleted",
        entityType: "Expense",
        entityId: id,
        phrase: "a supprimé une dépense",
        details: [money(expense.amountMinor, expense.currencyCode), expense.category.name, expense.wallet.name, formatDate(expense.date)].join(" · "),
      },
      title: "Dépense supprimée",
      url: "/depenses",
    },
  ]);

  await prisma.$transaction([
    prisma.wallet.update({ where: { id: expense.walletId }, data: { balanceMinor: { increment: expense.amountMinor } } }),
    prisma.expense.delete({ where: { id } }),
    ...activity.ops,
  ]);
  activity.deliver();

  return NextResponse.json({ ok: true });
}
