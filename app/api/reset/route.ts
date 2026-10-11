import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { prepareActivity } from "@/lib/activity";
import { jsonOk } from "@/lib/serialize";

/**
 * Danger-zone action (Paramètres → Zone de danger, associates only): permanently deletes every gain, expense and
 * transfer, and resets every wallet balance to 0. Accounts, currencies/rates, commissions, withdrawal routes,
 * categories and members are untouched. The associate must confirm in the UI first (styled dialog showing the
 * exact counts) — this route only performs what they already approved.
 */
export async function POST() {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const [gains, expenses, transfers] = await Promise.all([prisma.gain.count(), prisma.expense.count(), prisma.transfer.count()]);

  if (gains === 0 && expenses === 0 && transfers === 0) {
    return NextResponse.json({ error: "Il n'y a déjà plus rien à réinitialiser." }, { status: 400 });
  }

  const details = `${gains} gain(s) · ${expenses} dépense(s) · ${transfers} retrait(s) supprimés · tous les soldes remis à 0`;
  const activity = await prepareActivity([
    {
      actor: auth,
      audit: { action: "data.reset", entityType: "System", phrase: "a réinitialisé les données financières", details },
      title: "Données réinitialisées",
      body: `${auth.name} a réinitialisé les données financières — ${details}`,
    },
  ]);

  // Array (batch) form: the pooled Neon connection does not support interactive transactions. Transfers/gains/expenses
  // have no dependents (AuditLog.entityId is a soft text reference, not a foreign key), so deletion order is free.
  await prisma.$transaction([
    prisma.transfer.deleteMany({}),
    prisma.gain.deleteMany({}),
    prisma.expense.deleteMany({}),
    prisma.wallet.updateMany({ data: { balanceMinor: BigInt(0) } }),
    ...activity.ops,
  ]);
  activity.deliver();

  return jsonOk({ ok: true, deleted: { gains, expenses, transfers } });
}
