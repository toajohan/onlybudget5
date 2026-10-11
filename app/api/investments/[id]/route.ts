import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { investmentSchema } from "@/lib/validation/investment";
import { toMinorUnits } from "@/lib/currency";
import { jsonOk } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

/** Only the associate who recorded an investment can see, change or delete it. */
async function findOwn(id: string, userId: string) {
  const investment = await prisma.investment.findUnique({ where: { id } });
  return investment && investment.userId === userId ? investment : null;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!(await findOwn(id, auth.id))) return NextResponse.json({ error: "Investissement introuvable." }, { status: 404 });

  const parsed = investmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const { currentValueMajor, amountMajor, date, note, ...rest } = parsed.data;
  const investment = await prisma.investment.update({
    where: { id },
    data: {
      ...rest,
      amountMinor: toMinorUnits(amountMajor),
      currentValueMinor: currentValueMajor == null ? null : toMinorUnits(currentValueMajor),
      date: new Date(date),
      note: note || null,
    },
  });
  return jsonOk({ investment });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!(await findOwn(id, auth.id))) return NextResponse.json({ error: "Investissement introuvable." }, { status: 404 });

  await prisma.investment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
