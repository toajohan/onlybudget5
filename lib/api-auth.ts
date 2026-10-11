import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { User } from "@prisma/client";

export async function requireApiUser(): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  return user;
}

export async function requireApiAssocie(): Promise<User | NextResponse> {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "ASSOCIE") return NextResponse.json({ error: "Réservé aux associés." }, { status: 403 });
  return user;
}
