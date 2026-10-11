import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { categorySchema } from "@/lib/validation/settings";
import { prepareActivity } from "@/lib/activity";

/** Active expense categories, for the expense form's picker. Associates only (expenses are associate-only). */
export async function GET() {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const categories = await prisma.expenseCategory.findMany({ where: { archived: false }, orderBy: { name: "asc" } });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const activity = await prepareActivity([
    {
      actor: auth,
      audit: { action: "category.created", entityType: "ExpenseCategory", phrase: `a créé la catégorie ${parsed.data.name}` },
      title: "Nouvelle catégorie",
    },
  ]);
  const [category] = await prisma.$transaction([
    prisma.expenseCategory.create({
      data: { name: parsed.data.name, icon: parsed.data.icon, logoUrl: parsed.data.logoUrl || null },
    }),
    ...activity.ops,
  ]);
  activity.deliver();

  return NextResponse.json({ category }, { status: 201 });
}
