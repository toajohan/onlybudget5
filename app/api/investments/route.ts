import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { investmentSchema } from "@/lib/validation/investment";
import { toMinorUnits } from "@/lib/currency";
import { jsonOk } from "@/lib/serialize";

/** Records one of the signed-in associate's own investments. */
export async function POST(request: Request) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const parsed = investmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const { currentValueMajor, amountMajor, date, note, ...rest } = parsed.data;
  const investment = await prisma.investment.create({
    data: {
      ...rest,
      userId: auth.id,
      amountMinor: toMinorUnits(amountMajor),
      currentValueMinor: currentValueMajor == null ? null : toMinorUnits(currentValueMajor),
      date: new Date(date),
      note: note || null,
    },
  });
  return jsonOk({ investment }, { status: 201 });
}
