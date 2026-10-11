import { requireAssocie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamSection } from "@/components/team/TeamSection";

export default async function EquipePage() {
  const currentUser = await requireAssocie();
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { role: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      profitSharePercent: true,
      active: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Équipe" subtitle="Chatteurs et associés, et la part de bénéfice de chaque associé." />
      <TeamSection users={users} currentUserId={currentUser.id} />
    </div>
  );
}
