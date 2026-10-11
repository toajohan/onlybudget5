"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === ref.current) onClose();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={handleBackdropClick}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[28px] bg-surface p-0 text-foreground backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between px-6 pt-5 pb-2">
        <h2 className="text-[17px] font-medium">{title}</h2>
        <button
          onClick={onClose}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-tile text-muted hover:bg-surface-hover hover:text-foreground"
          type="button"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto px-6 pt-3 pb-6">{children}</div>
    </dialog>
  );
}
