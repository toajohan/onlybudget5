import { LayoutDashboard, TrendingUp, Receipt, Landmark, PiggyBank, History, Users, Settings, type LucideIcon } from "lucide-react";
import type { Role } from "@prisma/client";

export type NavItem = { href: string; label: string; shortLabel?: string; icon: LucideIcon; roles: Role[] };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", shortLabel: "Accueil", icon: LayoutDashboard, roles: ["ASSOCIE", "CHATTEUR"] },
  { href: "/gains", label: "Ventes", icon: TrendingUp, roles: ["ASSOCIE", "CHATTEUR"] },
  { href: "/depenses", label: "Dépenses", icon: Receipt, roles: ["ASSOCIE"] },
  { href: "/tresorerie", label: "Trésorerie", shortLabel: "Trésor.", icon: Landmark, roles: ["ASSOCIE"] },
  { href: "/investissement", label: "Investissement", shortLabel: "Investir", icon: PiggyBank, roles: ["ASSOCIE"] },
  { href: "/historique", label: "Historique", icon: History, roles: ["ASSOCIE", "CHATTEUR"] },
  { href: "/equipe", label: "Équipe", icon: Users, roles: ["ASSOCIE"] },
  { href: "/parametres", label: "Paramètres", icon: Settings, roles: ["ASSOCIE"] },
];
