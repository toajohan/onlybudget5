"use client";

import { useState } from "react";
import { IconPicker } from "@/components/icons/IconPicker";
import { EntityIcon } from "@/components/icons/EntityIcon";
import { Upload, X } from "lucide-react";

export function IconLogoField({
  icon,
  logoUrl,
  onIconChange,
  onLogoChange,
}: {
  icon: string;
  logoUrl: string | null;
  onIconChange: (icon: string) => void;
  onLogoChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Échec de l'import");
      onLogoChange(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'import");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black">
          <EntityIcon icon={icon} logoUrl={logoUrl} size={24} />
        </div>
        <label className="cursor-pointer">
          <span className="inline-flex h-10 items-center gap-2 rounded-full bg-tile px-4 text-sm text-foreground hover:bg-surface-hover">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Import..." : "Importer un logo"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
        {logoUrl && (
          <button type="button" onClick={() => onLogoChange(null)} className="text-muted hover:text-danger">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {!logoUrl && <IconPicker value={icon} onChange={onIconChange} />}
    </div>
  );
}
