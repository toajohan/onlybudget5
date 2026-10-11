import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { investmentProfileSchema } from "@/lib/validation/investment";
import { toMinorUnits } from "@/lib/currency";

/** Saves the signed-in associate's own advisor settings (living costs, risk profile). */
export async function PUT(request: Request) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const parsed = investmentProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const data = {
    monthlyLivingMinor: toMinorUnits(parsed.data.monthlyLivingMajor),
    currencyCode: parsed.data.currencyCode,
    riskProfile: parsed.data.riskProfile,
  };
  await prisma.investmentProfile.upsert({ where: { userId: auth.id }, update: data, create: { userId: auth.id, ...data } });
  return NextResponse.json({ ok: true });
}
