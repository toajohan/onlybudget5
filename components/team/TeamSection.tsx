"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { UserForm, type SafeUser } from "@/components/forms/UserForm";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { Plus, Pencil, UserX, UserCheck } from "lucide-react";

const ICON_BUTTON = "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-white/10";

export function TeamSection({ users, currentUserId }: { users: SafeUser[]; currentUserId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SafeUser | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingUser(undefined);
    setModalOpen(true);
  }
  function openEdit(user: SafeUser) {
    setEditingUser(user);
    setModalOpen(true);
  }

  async function toggleActive(user: SafeUser) {
    setError(null);
    if (user.active) {
      const ok = await confirm({
        title: `Désactiver ${user.name} ?`,
        message: "Cette personne ne pourra plus se connecter. Ses gains et son historique sont conservés, et vous pourrez la réactiver.",
        confirmLabel: "Désactiver",
        tone: "danger",
      });
      if (!ok) return;
    }
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur.");
      return;
    }
    toast({ title: user.active ? "Membre désactivé" : "Membre réactivé", message: user.name });
    router.refresh();
  }

  const associates = users.filter((u) => u.role === "ASSOCIE");
  const chatters = users.filter((u) => u.role === "CHATTEUR");

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Membres</CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Ajouter un membre
        </Button>
      </div>

      {error && <p className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 space-y-6">
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Associés</p>
          <div className="space-y-2">
            {associates.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} onEdit={() => openEdit(u)} onToggleActive={() => toggleActive(u)} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-muted">Chatteurs</p>
          {chatters.length === 0 ? (
            <p className="text-sm text-muted">Aucun chatteur pour l&apos;instant.</p>
          ) : (
            <div className="space-y-2">
              {chatters.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} onEdit={() => openEdit(u)} onToggleActive={() => toggleActive(u)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? "Modifier le membre" : "Nouveau membre"}>
        <UserForm key={editingUser?.id ?? "new"} user={editingUser} onSuccess={() => setModalOpen(false)} />
      </Modal>
    </Card>
  );
}

function UserRow({
  user,
  isSelf,
  onEdit,
  onToggleActive,
}: {
  user: SafeUser;
  isSelf: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-3xl bg-tile px-3.5 py-3 ${!user.active ? "opacity-50" : ""}`}>
      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-foreground">
            {user.name}
            {isSelf && <span className="text-muted"> (moi)</span>}
          </p>
          {!user.active && <Badge variant="danger">Désactivé</Badge>}
        </div>
        <p className="truncate text-xs text-muted">
          {user.email}
          {user.role === "ASSOCIE" && ` · ${user.profitSharePercent ?? 0}% du bénéfice`}
        </p>
      </div>
      <div className="flex shrink-0 gap-0.5">
        <button onClick={onEdit} className={`${ICON_BUTTON} hover:text-foreground`} title="Modifier" aria-label={`Modifier ${user.name}`}>
          <Pencil className="h-4 w-4" />
        </button>
        {!isSelf && (
          <button
            onClick={onToggleActive}
            className={`${ICON_BUTTON} hover:text-danger`}
            title={user.active ? "Désactiver" : "Réactiver"}
            aria-label={`${user.active ? "Désactiver" : "Réactiver"} ${user.name}`}
          >
            {user.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
