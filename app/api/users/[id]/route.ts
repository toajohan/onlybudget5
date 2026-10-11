import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { userUpdateSchema } from "@/lib/validation/users";
import { hashPassword } from "@/lib/auth/password";
import { formatNumberFr, roleLabel } from "@/lib/audit";
import { prepareActivity, type ActivityItem } from "@/lib/activity";

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  profitSharePercent: true,
  active: true,
  createdAt: true,
} as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });

  const demotingOrDeactivating =
    (parsed.data.role && parsed.data.role !== "ASSOCIE" && target.role === "ASSOCIE") ||
    (parsed.data.active === false && target.role === "ASSOCIE");
  if (demotingOrDeactivating) {
    const activeAssociateCount = await prisma.user.count({ where: { role: "ASSOCIE", active: true } });
    if (activeAssociateCount <= 1) {
      return NextResponse.json({ error: "Impossible : il doit rester au moins un associé actif." }, { status: 400 });
    }
  }

  if (parsed.data.email && parsed.data.email !== target.email) {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 400 });
  }

  const passwordHash = parsed.data.password ? await hashPassword(parsed.data.password) : undefined;
  const d = parsed.data;
  const nextShare = d.role === "CHATTEUR" ? null : d.profitSharePercent;
  const nextAvatar = d.avatarUrl === undefined ? undefined : d.avatarUrl || null;
  const name = d.name ?? target.name;

  // Audit trail. Never write the password itself: only the fact that it was reset.
  const parts: string[] = [];
  if (d.name !== undefined && d.name !== target.name) parts.push(`Nom : ${target.name} → ${d.name}`);
  if (d.email !== undefined && d.email !== target.email) parts.push(`Email : ${target.email} → ${d.email}`);
  if (d.role !== undefined && d.role !== target.role) parts.push(`Rôle : ${roleLabel(target.role)} → ${roleLabel(d.role)}`);
  if (nextShare !== undefined && nextShare !== target.profitSharePercent) {
    const show = (v: number | null) => (v === null ? "—" : `${formatNumberFr(v)} %`);
    parts.push(`Part du bénéfice : ${show(target.profitSharePercent)} → ${show(nextShare)}`);
  }
  if (nextAvatar !== undefined && nextAvatar !== target.avatarUrl) {
    parts.push(nextAvatar ? (target.avatarUrl ? "Photo remplacée" : "Photo ajoutée") : "Photo retirée");
  }
  if (passwordHash) parts.push("Mot de passe réinitialisé");

  const items: ActivityItem[] = [];
  if (parts.length > 0) {
    items.push({
      actor: auth,
      audit: { action: "user.updated", entityType: "User", entityId: id, phrase: `a modifié le membre ${name}`, details: parts.join(" · ") },
      title: "Membre modifié",
    });
  }
  if (d.active !== undefined && d.active !== target.active) {
    items.push({
      actor: auth,
      audit: {
        action: d.active ? "user.reactivated" : "user.deactivated",
        entityType: "User",
        entityId: id,
        phrase: `a ${d.active ? "réactivé" : "désactivé"} le membre ${name}`,
      },
      title: d.active ? "Membre réactivé" : "Membre désactivé",
    });
  }
  const activity = await prepareActivity(items);

  const update = prisma.user.update({
    where: { id },
    data: {
      name: d.name,
      email: d.email,
      role: d.role,
      profitSharePercent: nextShare,
      avatarUrl: nextAvatar,
      active: d.active,
      passwordHash,
      mustChangePassword: passwordHash ? true : undefined,
    },
    select: SAFE_SELECT,
  });
  const results = await prisma.$transaction([update, ...activity.ops]);
  activity.deliver();
  const user = results[0] as Awaited<typeof update>;

  return NextResponse.json({ user });
}
