import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getHistory } from "@/lib/history";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { HistoryTable } from "@/components/tables/HistoryTable";

export default async function HistoriquePage() {
  const user = await requireUser();
  const isAssociate = user.role === "ASSOCIE";
  const [entries, currencies] = await Promise.all([
    getHistory(isAssociate ? { limit: 150 } : { chatterId: user.id, limit: 150 }),
    prisma.currency.findMany(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique"
        subtitle={
          isAssociate
            ? "Toutes les actions : gains, dépenses, retraits et modifications des associés."
            : "Vos gains enregistrés."
        }
      />
      <Card>
        <CardTitle>{isAssociate ? "Activité de l'agence" : "Mon activité"}</CardTitle>
        <div className="mt-4">
          <HistoryTable entries={entries} currencies={currencies} filterable={isAssociate} />
        </div>
      </Card>
    </div>
  );
}
