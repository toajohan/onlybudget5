import { prisma } from "@/lib/prisma";
import { formatMajor } from "@/lib/currency";

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  /** French verb phrase read right after the performer's name: "a modifié le taux EUR". */
  phrase: string;
  /** Optional second line with the before → after detail: "4 985 → 5 000 Ar". */
  details?: string | null;
  userId: string;
};

/**
 * Lazy Prisma operation: batch it with the mutation in `prisma.$transaction([mutation, auditOp(...)])`
 * so the change and its audit entry succeed or fail together. (Array form on purpose: the pooled
 * Neon connection does not support interactive transactions.)
 */
export function auditOp(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.details ? `${input.phrase}\n${input.details}` : input.phrase,
      performedById: input.userId,
    },
  });
}

/** Inverse of the `summary` built by auditOp: first line = phrase, the rest = details. */
export function splitSummary(summary: string): { phrase: string; details: string | null } {
  const at = summary.indexOf("\n");
  return at === -1 ? { phrase: summary, details: null } : { phrase: summary.slice(0, at), details: summary.slice(at + 1) };
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "oui" : "non";
  return String(value);
}

/** "Nom : A → B · Rôle : X → Y" for every [label, before, after] triple whose value actually changed. */
export function describeChanges(changes: Array<[label: string, before: unknown, after: unknown]>): string {
  return changes
    .filter(([, before, after]) => before !== after)
    .map(([label, before, after]) => `${label} : ${show(before)} → ${show(after)}`)
    .join(" · ");
}

export function formatNumberFr(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(value);
}

export function roleLabel(role: string): string {
  return role === "ASSOCIE" ? "Associé" : "Chatteur";
}

/** "sans frais" | "2 %" | "3,00 $" — how a withdrawal route's fee reads in an audit line. */
export function describeFee(
  feeType: string,
  feePercent: number | null,
  feeFixedMinor: bigint | number | null,
  currencyCode: string
): string {
  if (feeType === "PERCENT") return `${formatNumberFr(feePercent ?? 0)} %`;
  if (feeType === "FIXED") return formatMajor(Number(feeFixedMinor ?? 0) / 100, currencyCode);
  return "sans frais";
}
