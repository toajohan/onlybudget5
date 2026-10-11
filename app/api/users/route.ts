import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAssocie } from "@/lib/api-auth";
import { userCreateSchema } from "@/lib/validation/users";
import { hashPassword } from "@/lib/auth/password";
import { formatNumberFr, roleLabel } from "@/lib/audit";
import { prepareActivity } from "@/lib/activity";

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

/** Active members (associates and chatteurs) — e.g. the "log this gain for" picker. Associates only. */
export async function GET() {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    select: SAFE_SELECT,
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const share = parsed.data.role === "ASSOCIE" ? (parsed.data.profitSharePercent ?? 0) : null;

  const activity = await prepareActivity([
    {
      actor: auth,
      audit: {
        action: "user.created",
        entityType: "User",
        phrase: `a ajouté le membre ${parsed.data.name}`,
        details: `${roleLabel(parsed.data.role)}${share !== null ? ` · part ${formatNumberFr(share)} %` : ""}`,
      },
      title: "Nouveau membre",
    },
  ]);
  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
        profitSharePercent: share,
        avatarUrl: parsed.data.avatarUrl || null,
        mustChangePassword: true,
      },
      select: SAFE_SELECT,
    }),
    ...activity.ops,
  ]);
  activity.deliver();

  return NextResponse.json({ user }, { status: 201 });
}
