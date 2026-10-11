import { prisma } from "@/lib/prisma";
import { splitSummary } from "@/lib/audit";

type Base = {
  id: string;
  /** When the entry was recorded (real timestamp). The feed is ordered and grouped by it. */
  createdAt: Date;
  createdByName: string;
};

export type HistoryEntry =
  | (Base & {
      type: "GAIN";
      /** Business date chosen by the user (stored at UTC midnight). */
      date: Date;
      /** Net of the wallet's commission: the amount that counts. */
      amountMinor: number;
      /** Amount as typed, before the commission (null for gains recorded before commissions existed). */
      grossAmountMinor: number | null;
      commissionPercent: number | null;
      currencyCode: string;
      chatterName: string;
      walletName: string;
      walletIcon: string | null;
      walletLogoUrl: string | null;
      note: string | null;
    })
  | (Base & {
      type: "EXPENSE";
      date: Date;
      amountMinor: number;
      currencyCode: string;
      categoryName: string;
      categoryIcon: string | null;
      categoryLogoUrl: string | null;
      walletName: string;
      note: string | null;
    })
  | (Base & {
      type: "TRANSFER";
      date: Date;
      amountSentMinor: number;
      feeAmountMinor: number;
      amountReceivedMinor: number;
      fromCurrencyCode: string;
      toCurrencyCode: string;
      fromWalletName: string;
      toWalletName: string;
      note: string | null;
    })
  | (Base & {
      type: "AUDIT";
      action: string;
      entityType: string;
      /** Read after the performer's name: "a modifié le taux EUR". */
      phrase: string;
      /** Before → after detail, when there is one. */
      details: string | null;
    });

/**
 * Unified, chronological activity feed built at read time: gains, expenses and transfers are their own history;
 * the audit table only adds what those tables cannot show (settings edits, deletions...).
 * A chatter only ever sees their own gains.
 */
export async function getHistory(options?: { chatterId?: string; limit?: number }): Promise<HistoryEntry[]> {
  const limit = options?.limit ?? 100;
  const scopedToChatter = Boolean(options?.chatterId);

  const [gains, expenses, transfers, audits] = await Promise.all([
    prisma.gain.findMany({
      where: options?.chatterId ? { chatterId: options.chatterId } : undefined,
      include: { chatter: true, wallet: true, createdBy: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    scopedToChatter
      ? Promise.resolve([])
      : prisma.expense.findMany({
          include: { category: true, wallet: true, createdBy: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
    scopedToChatter
      ? Promise.resolve([])
      : prisma.transfer.findMany({
          include: { fromWallet: true, toWallet: true, createdBy: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
    scopedToChatter
      ? Promise.resolve([])
      : prisma.auditLog.findMany({
          include: { performedBy: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
  ]);

  const entries: HistoryEntry[] = [
    ...gains.map((g) => ({
      type: "GAIN" as const,
      id: g.id,
      createdAt: g.createdAt,
      date: g.date,
      amountMinor: Number(g.amountMinor),
      grossAmountMinor: g.grossAmountMinor === null ? null : Number(g.grossAmountMinor),
      commissionPercent: g.commissionPercent,
      currencyCode: g.currencyCode,
      chatterName: g.chatter.name,
      walletName: g.wallet.name,
      walletIcon: g.wallet.icon,
      walletLogoUrl: g.wallet.logoUrl,
      createdByName: g.createdBy.name,
      note: g.note,
    })),
    ...expenses.map((e) => ({
      type: "EXPENSE" as const,
      id: e.id,
      createdAt: e.createdAt,
      date: e.date,
      amountMinor: Number(e.amountMinor),
      currencyCode: e.currencyCode,
      categoryName: e.category.name,
      categoryIcon: e.category.icon,
      categoryLogoUrl: e.category.logoUrl,
      walletName: e.wallet.name,
      createdByName: e.createdBy.name,
      note: e.note,
    })),
    ...transfers.map((t) => ({
      type: "TRANSFER" as const,
      id: t.id,
      createdAt: t.createdAt,
      date: t.date,
      amountSentMinor: Number(t.amountSentMinor),
      feeAmountMinor: Number(t.feeAmountMinor),
      amountReceivedMinor: Number(t.amountReceivedMinor),
      fromCurrencyCode: t.fromCurrencyCode,
      toCurrencyCode: t.toCurrencyCode,
      fromWalletName: t.fromWallet.name,
      toWalletName: t.toWallet.name,
      createdByName: t.createdBy.name,
      note: t.note,
    })),
    ...audits.map((a) => {
      const { phrase, details } = splitSummary(a.summary);
      return {
        type: "AUDIT" as const,
        id: a.id,
        createdAt: a.createdAt,
        createdByName: a.performedBy.name,
        action: a.action,
        entityType: a.entityType,
        phrase,
        details,
      };
    }),
  ];

  entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return entries.slice(0, limit);
}
