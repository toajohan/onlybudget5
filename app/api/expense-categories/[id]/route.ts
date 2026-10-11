import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { categoryUpdateSchema } from "@/lib/validation/settings";
import { prepareActivity, type ActivityItem } from "@/lib/activity";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = categoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const before = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });

  const d = parsed.data;
  const archived = d.archived;
  const nextLogo = d.logoUrl === undefined ? undefined : d.logoUrl || null;
  const name = d.name ?? before.name;

  const parts: string[] = [];
  if (d.name !== undefined && d.name !== before.name) parts.push(`Nom : ${before.name} → ${d.name}`);
  if (d.icon !== undefined && d.icon !== before.icon) parts.push("Icône modifiée");
  if (nextLogo !== undefined && nextLogo !== before.logoUrl) {
    parts.push(nextLogo ? (before.logoUrl ? "Logo remplacé" : "Logo ajouté") : "Logo retiré");
  }

  const items: ActivityItem[] = [];
  if (parts.length > 0) {
    items.push({
      actor: auth,
      audit: { action: "category.updated", entityType: "ExpenseCategory", entityId: id, phrase: `a modifié la catégorie ${name}`, details: parts.join(" · ") },
      title: "Catégorie modifiée",
    });
  }
  if (archived !== undefined && archived !== before.archived) {
    items.push({
      actor: auth,
      audit: {
        action: archived ? "category.archived" : "category.restored",
        entityType: "ExpenseCategory",
        entityId: id,
        phrase: `a ${archived ? "archivé" : "réactivé"} la catégorie ${name}`,
      },
      title: archived ? "Catégorie archivée" : "Catégorie réactivée",
    });
  }
  const activity = await prepareActivity(items);

  const update = prisma.expenseCategory.update({
    where: { id },
    data: { name: d.name, icon: d.icon, logoUrl: nextLogo, archived },
  });
  const results = await prisma.$transaction([update, ...activity.ops]);
  activity.deliver();
  const category = results[0] as Awaited<typeof update>;

  return NextResponse.json({ category });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const before = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });

  const update = prisma.expenseCategory.update({ where: { id }, data: { archived: true } });
  const activity = await prepareActivity(
    before.archived
      ? []
      : [
          {
            actor: auth,
            audit: { action: "category.archived", entityType: "ExpenseCategory", entityId: id, phrase: `a archivé la catégorie ${before.name}` },
            title: "Catégorie archivée",
          },
        ]
  );
  const results = await prisma.$transaction([update, ...activity.ops]);
  activity.deliver();
  const category = results[0] as Awaited<typeof update>;

  return NextResponse.json({ category });
}
