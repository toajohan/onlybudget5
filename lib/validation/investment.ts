import { z } from "zod";
import { INVESTMENT_TYPES, RISK_PROFILES } from "@/lib/investment";

const currencyCode = z.enum(["USD", "EUR", "MGA"], { message: "Devise invalide" });

export const investmentProfileSchema = z.object({
  monthlyLivingMajor: z.number({ message: "Montant requis" }).min(0, "Montant invalide"),
  currencyCode,
  riskProfile: z.enum(RISK_PROFILES, { message: "Profil invalide" }),
});
export type InvestmentProfileInput = z.infer<typeof investmentProfileSchema>;

export const investmentSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80, "80 caractères maximum"),
  type: z.enum(INVESTMENT_TYPES, { message: "Type invalide" }),
  amountMajor: z.number({ message: "Montant requis" }).positive("Montant requis"),
  /** Null when no current value is known yet: the amount put in is used instead. */
  currentValueMajor: z.number().min(0, "Valeur invalide").nullable().optional(),
  currencyCode,
  date: z.string().min(1, "Date requise"),
  note: z.string().max(300).optional(),
});
export type InvestmentInput = z.infer<typeof investmentSchema>;
