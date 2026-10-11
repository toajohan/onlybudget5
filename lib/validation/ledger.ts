import { z } from "zod";

export const gainCreateSchema = z.object({
  chatterId: z.string().min(1, "Chatteur requis"),
  walletId: z.string().min(1, "Compte requis"),
  amountMajor: z.number().positive("Montant requis"),
  date: z.string().min(1, "Date requise"),
  note: z.string().optional(),
});
export type GainCreateInput = z.infer<typeof gainCreateSchema>;

export const expenseCreateSchema = z.object({
  categoryId: z.string().min(1, "Catégorie requise"),
  walletId: z.string().min(1, "Compte requis"),
  amountMajor: z.number().positive("Montant requis"),
  date: z.string().min(1, "Date requise"),
  note: z.string().optional(),
});
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

export const transferCreateSchema = z.object({
  fromWalletId: z.string().min(1, "Compte source requis"),
  toWalletId: z.string().min(1, "Compte destination requis"),
  amountMajor: z.number().positive("Montant requis"),
  note: z.string().optional(),
});
export type TransferCreateInput = z.infer<typeof transferCreateSchema>;
