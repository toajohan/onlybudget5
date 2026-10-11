import { z } from "zod";

export const userCreateSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  role: z.enum(["ASSOCIE", "CHATTEUR"]),
  profitSharePercent: z.number().min(0).max(100).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userFormSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  password: z.union([z.string().min(8, "8 caractères minimum"), z.literal("")]),
  role: z.enum(["ASSOCIE", "CHATTEUR"]),
  profitSharePercent: z.number().min(0).max(100).optional().nullable(),
});
export type UserFormInput = z.infer<typeof userFormSchema>;

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["ASSOCIE", "CHATTEUR"]).optional(),
  profitSharePercent: z.number().min(0).max(100).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  active: z.boolean().optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
