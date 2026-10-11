import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { jsonOk } from "@/lib/serialize";

/** All currencies and their rate to the base (Ariary) — read-only list for clients (mobile app, etc.). */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const currencies = await prisma.currency.findMany({ orderBy: { code: "asc" } });
  return jsonOk({ currencies });
}
