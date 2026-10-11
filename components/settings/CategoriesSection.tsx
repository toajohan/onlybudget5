"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LogoCircle } from "@/components/ui/LogoCircle";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { CategoryForm } from "@/components/forms/CategoryForm";
import { Plus, Pencil, ArchiveRestore, Archive } from "lucide-react";
import type { ExpenseCategory } from "@prisma/client";

const ICON_BUTTON =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-white/10";

export function CategoriesSection({ categories }: { categories: ExpenseCategory[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | undefined>(undefined);

  function openCreate() {
    setEditingCategory(undefined);
    setModalOpen(true);
  }
  function openEdit(category: ExpenseCategory) {
    setEditingCategory(category);
    setModalOpen(true);
  }

  async function toggleArchive(category: ExpenseCategory) {
    if (!category.archived) {
      const ok = await confirm({
        title: `Archiver « ${category.name} » ?`,
        message: "La catégorie n'apparaîtra plus dans le formulaire de dépenses. Les dépenses déjà enregistrées sont conservées.",
        confirmLabel: "Archiver",
        tone: "danger",
      });
      if (!ok) return;
    }
    const res = await fetch(`/api/expense-categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !category.archived }),
    });
    if (!res.ok) {
      toast({ tone: "error", message: "Impossible de modifier cette catégorie." });
      return;
    }
    toast({ title: category.archived ? "Catégorie réactivée" : "Catégorie archivée", message: category.name });
    router.refresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Catégories de dépenses</CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className={`flex items-center gap-2 rounded-full bg-tile py-1.5 pr-2 pl-1.5 ${category.archived ? "opacity-50" : ""}`}
          >
            <LogoCircle icon={category.icon} logoUrl={category.logoUrl} size={32} />
            <span className="text-sm text-foreground">{category.name}</span>
            <button onClick={() => openEdit(category)} className={`${ICON_BUTTON} hover:text-foreground`} title="Modifier" aria-label={`Modifier ${category.name}`}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => toggleArchive(category)}
              className={`${ICON_BUTTON} hover:text-danger`}
              title={category.archived ? "Réactiver" : "Archiver"}
              aria-label={`${category.archived ? "Réactiver" : "Archiver"} ${category.name}`}
            >
              {category.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"}>
        <CategoryForm key={editingCategory?.id ?? "new"} category={editingCategory} onSuccess={() => setModalOpen(false)} />
      </Modal>
    </Card>
  );
}
