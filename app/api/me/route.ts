import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { jsonOk } from "@/lib/serialize";

/** The signed-in user's own profile (mobile app: who am I, what can I do). */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const { id, name, email, role, avatarUrl, profitSharePercent } = auth;
  return jsonOk({ user: { id, name, email, role, avatarUrl, profitSharePercent } });
}
