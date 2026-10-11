import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditOp } from "@/lib/audit";
import { sendPushToUsers, type PushPayload } from "@/lib/push";

type Actor = { id: string; name: string };

export type ActivityItem = {
  actor: Actor;
  /** Audit trail line (omit for gains/expenses/transfers creation: those tables are their own history). */
  audit?: { action: string; entityType: string; entityId?: string | null; phrase: string; details?: string | null };
  /** Machine key of the notification; defaults to the audit action. */
  kind?: string;
  title?: string;
  /** Defaults to "<actor> <phrase> — <details>". */
  body?: string;
  /** Page opened when the notification is clicked. */
  url?: string;
  /** Picture shown with the notification, e.g. the platform's logo. */
  imageUrl?: string | null;
  /** Extra recipients besides the other associates, e.g. the chatter whose gain was edited. */
  alsoUserIds?: Array<string | null | undefined>;
};

type Operation = ReturnType<typeof auditOp> | ReturnType<typeof prisma.notification.createMany>;

/**
 * Everything that must happen when someone changes something: the audit line and the notifications for the
 * other associates (plus the people concerned). `ops` are lazy Prisma operations to put in the same array-form
 * `$transaction` as the change itself; `deliver()` sends the system (push) notifications after the response.
 */
export async function prepareActivity(items: ActivityItem[]) {
  const associates = await prisma.user.findMany({ where: { role: "ASSOCIE", active: true }, select: { id: true } });
  const associateIds = associates.map((a) => a.id);

  const extraIds = [...new Set(items.flatMap((i) => i.alsoUserIds ?? []).filter((id): id is string => Boolean(id)))];
  const activeExtra = new Set(
    extraIds.length
      ? (await prisma.user.findMany({ where: { id: { in: extraIds }, active: true }, select: { id: true } })).map((u) => u.id)
      : []
  );

  const ops: Operation[] = [];
  const pushes: Array<{ recipients: string[]; payload: PushPayload }> = [];

  for (const item of items) {
    if (item.audit) ops.push(auditOp({ ...item.audit, userId: item.actor.id }));

    const extra = (item.alsoUserIds ?? []).filter((id): id is string => Boolean(id) && activeExtra.has(id as string));
    const recipients = [...new Set([...associateIds, ...extra])].filter((id) => id !== item.actor.id);
    if (recipients.length === 0) continue;

    const kind = item.kind ?? item.audit?.action ?? "activity";
    const title = item.title ?? "Modification";
    const body =
      item.body ??
      (item.audit ? `${item.actor.name} ${item.audit.phrase}${item.audit.details ? ` — ${item.audit.details}` : ""}` : title);
    const url = item.url ?? "/historique";
    const imageUrl = item.imageUrl ?? undefined;

    ops.push(prisma.notification.createMany({ data: recipients.map((userId) => ({ userId, kind, title, body, url, imageUrl })) }));
    pushes.push({ recipients, payload: { title, body, url, tag: kind, imageUrl } });
  }

  return {
    ops,
    /** Call once the transaction succeeded. Runs after the response so the request is not slowed down. */
    deliver() {
      if (pushes.length === 0) return;
      after(async () => {
        for (const { recipients, payload } of pushes) await sendPushToUsers(recipients, payload);
      });
    },
  };
}
