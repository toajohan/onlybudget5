import { requireUser } from "@/lib/auth/session";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";

export default async function ProfilPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <PageHeader title="Mon profil" subtitle={`${user.name} · ${user.email}`} />

      {user.mustChangePassword && (
        <p className="rounded-2xl bg-ember/15 px-4 py-3 text-sm text-ember">
          Pensez à changer votre mot de passe par défaut dès maintenant.
        </p>
      )}

      <Card className="max-w-md">
        <CardTitle>Changer mon mot de passe</CardTitle>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </Card>
    </div>
  );
}
