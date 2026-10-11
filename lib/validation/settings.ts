import { z } from "zod";

export const currencyRateUpdateSchema = z.object({
  rateToBase: z.number().positive("Le taux doit être positif"),
});
export type CurrencyRateUpdateInput = z.infer<typeof currencyRateUpdateSchema>;

export const walletCreateSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  icon: z.string().min(1, "Icône requise"),
  logoUrl: z.string().optional().nullable(),
  currencyCode: z.string().min(1, "Devise requise"),
  ownerId: z.string().optional().nullable(),
  isSource: z.boolean(),
  initialBalanceMajor: z.number().min(0),
  // Share kept by the platform on each gain typed on this wallet (15 for Wysper); 0 = none.
  commissionPercent: z
    .number({ error: "Commission invalide (0 à 100)" })
    .min(0, "La commission ne peut pas être négative")
    .max(100, "La commission ne peut pas dépasser 100 %"),
});
export type WalletCreateInput = z.infer<typeof walletCreateSchema>;

// Client form validates only what react-hook-form actually holds: icon/logoUrl live in local
// component state (icon picker / upload) and are merged into the payload, then validated server-side.
export const walletFormSchema = walletCreateSchema.omit({ icon: true, logoUrl: true });
export type WalletFormValues = z.infer<typeof walletFormSchema>;

export const walletUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  // Changing it relabels every amount of the account (no conversion): see PATCH /api/wallets/[id].
  currencyCode: z.string().min(1).optional(),
  icon: z.string().min(1).optional(),
  logoUrl: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  isSource: z.boolean().optional(),
  archived: z.boolean().optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
});
export type WalletUpdateInput = z.infer<typeof walletUpdateSchema>;

export const walletRouteSchema = z
  .object({
    fromWalletId: z.string().min(1, "Compte source requis"),
    toWalletId: z.string().min(1, "Compte destination requis"),
    feeType: z.enum(["NONE", "PERCENT", "FIXED"]),
    feePercent: z.number().min(0).max(100).optional().nullable(),
    feeFixedMajor: z.number().min(0).optional().nullable(),
  })
  .refine((d) => d.fromWalletId !== d.toWalletId, {
    message: "Le compte source et destination doivent être différents",
    path: ["toWalletId"],
  });
export type WalletRouteInput = z.infer<typeof walletRouteSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, "Nom requis"),
  icon: z.string().min(1, "Icône requise"),
  logoUrl: z.string().optional().nullable(),
});
export type CategoryInput = z.infer<typeof categorySchema>;

// The settings page archives/restores a category through PATCH { archived }, so it belongs in the update schema
// (zod strips unknown keys: without it the toggle silently did nothing).
export const categoryUpdateSchema = categorySchema.partial().extend({ archived: z.boolean().optional() });

export const categoryFormSchema = categorySchema.omit({ icon: true, logoUrl: true });
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
