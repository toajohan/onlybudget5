import {
  Landmark,
  Smartphone,
  Bitcoin,
  CreditCard,
  Heart,
  Wrench,
  Home,
  UtensilsCrossed,
  PiggyBank,
  MoreHorizontal,
  Wallet,
  Banknote,
  DollarSign,
  Euro,
  Coins,
  ShoppingCart,
  Car,
  Plane,
  Gift,
  Briefcase,
  Building2,
  Globe,
  Zap,
  Laptop,
  Wifi,
  type LucideIcon,
} from "lucide-react";

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  Landmark,
  Smartphone,
  Bitcoin,
  CreditCard,
  Heart,
  Wrench,
  Home,
  UtensilsCrossed,
  PiggyBank,
  MoreHorizontal,
  Wallet,
  Banknote,
  DollarSign,
  Euro,
  Coins,
  ShoppingCart,
  Car,
  Plane,
  Gift,
  Briefcase,
  Building2,
  Globe,
  Zap,
  Laptop,
  Wifi,
};

export const ICON_OPTIONS = Object.keys(ICON_REGISTRY);

export function resolveIcon(key?: string | null): LucideIcon {
  if (key && ICON_REGISTRY[key]) return ICON_REGISTRY[key];
  return Wallet;
}
