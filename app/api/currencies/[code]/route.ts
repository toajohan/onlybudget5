import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { currencyRateUpdateSchema } from "@/lib/validation/settings";
import { formatNumberFr } from "@/lib/audit";
import { prepareActivity } from "@/lib/activity";

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const { code } = await params;
  const currency = await prisma.currency.findUnique({ where: { code } });
  if (!currency) return NextResponse.json({ error: "Devise introuvable." }, { status: 404 });
  if (currency.isBase) {
    return NextResponse.json({ error: "Le taux de la devise de référence ne peut pas être modifié." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = currencyRateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const { rateToBase } = parsed.data;
  const update = prisma.currency.update({ where: { code }, data: { rateToBase } });

  // Saving an unchanged rate is not a "modification": nothing to log.
  if (rateToBase === currency.rateToBase) {
    return NextResponse.json({ currency: await update });
  }

  const activity = await prepareActivity([
    {
      actor: auth,
      audit: {
        action: "currency.rate_updated",
        entityType: "Currency",
        entityId: code,
        phrase: `a modifié le taux ${code}`,
        details: `${formatNumberFr(currency.rateToBase)} → ${formatNumberFr(rateToBase)} Ar`,
      },
      title: "Taux de change modifié",
    },
  ]);
  const [updated] = await prisma.$transaction([update, ...activity.ops]);
  activity.deliver();

  return NextResponse.json({ currency: updated });
}
