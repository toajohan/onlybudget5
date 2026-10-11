"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userFormSchema, type UserFormInput } from "@/lib/validation/users";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Upload, User as UserIcon } from "lucide-react";

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: "ASSOCIE" | "CHATTEUR";
  avatarUrl: string | null;
  profitSharePercent: number | null;
  active: boolean;
};

export function UserForm({ user, onSuccess }: { user?: SafeUser; onSuccess: () => void }) {
  const router = useRouter();
  const isEdit = Boolean(user);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormInput>({
    resolver: zodResolver(userFormSchema),
    defaultValues: user
      ? { name: user.name, email: user.email, password: "", role: user.role, profitSharePercent: user.profitSharePercent ?? undefined }
      : { name: "", email: "", password: "", role: "CHATTEUR", profitSharePercent: undefined },
  });
  const role = watch("role");

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const body = await res.json();
      if (res.ok) setAvatarUrl(body.url);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onSubmit(data: UserFormInput) {
    setServerError(null);
    const payload: Record<string, unknown> = { ...data, avatarUrl };
    if (isEdit && !data.password) delete payload.password;
    if (data.role === "CHATTEUR") payload.profitSharePercent = null;

    const url = isEdit ? `/api/users/${user!.id}` : "/api/users";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-tile">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserIcon className="h-5 w-5 text-muted" />
          )}
        </div>
        <label className="cursor-pointer">
          <span className="inline-flex h-10 items-center gap-2 rounded-full bg-tile px-4 text-sm text-foreground hover:bg-surface-hover">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Import..." : "Photo de profil"}
          </span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} disabled={uploading} />
        </label>
      </div>

      <div>
        <Label>Nom</Label>
        <Input {...register("name")} />
        <FormError message={errors.name?.message} />
      </div>

      <div>
        <Label>Email</Label>
        <Input type="email" {...register("email")} />
        <FormError message={errors.email?.message} />
      </div>

      <div>
        <Label>{isEdit ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"}</Label>
        <Input type="password" {...register("password")} />
        <FormError message={errors.password?.message} />
      </div>

      <div>
        <Label>Rôle</Label>
        <Select {...register("role")}>
          <option value="CHATTEUR">Chatteur</option>
          <option value="ASSOCIE">Associé</option>
        </Select>
      </div>

      {role === "ASSOCIE" && (
        <div>
          <Label>Part du bénéfice net (%)</Label>
          <Input type="number" min="0" max="100" step="0.1" {...register("profitSharePercent", { valueAsNumber: true })} />
        </div>
      )}

      {serverError && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{serverError}</p>}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        {isEdit ? "Enregistrer" : "Créer le compte"}
      </Button>
    </form>
  );
}
