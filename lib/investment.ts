/**
 * The investment advisor's rules, kept pure (numbers in, advice out) so they can be checked without a database.
 * Every amount is in MAJOR units of one display currency; `smallAmount` is the "too small to bother" line in it.
 */

export const RISK_PROFILES = ["PRUDENT", "EQUILIBRE", "DYNAMIQUE"] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

export const INVESTMENT_TYPES = ["EPARGNE", "ETF", "ACTIONS", "CRYPTO", "IMMOBILIER", "BUSINESS", "AUTRE"] as const;
export type InvestmentType = (typeof INVESTMENT_TYPES)[number];

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  EPARGNE: "Épargne sécurisée",
  ETF: "ETF / indices",
  ACTIONS: "Actions",
  CRYPTO: "Crypto",
  IMMOBILIER: "Immobilier / terrain",
  BUSINESS: "Business OFM (matériel, outils)",
  AUTRE: "Autre",
};

export const RISK_PROFILE_LABELS: Record<RiskProfile, string> = {
  PRUDENT: "Prudent",
  EQUILIBRE: "Équilibré",
  DYNAMIQUE: "Dynamique",
};

type ProfileRules = {
  /** Months of living costs to keep aside before investing anything. */
  reserveMonths: number;
  /** Share of each month's surplus to invest once the reserve is full (the rest stays as cash). */
  investShareOfSurplus: number;
  /** Highest share of everything invested that crypto should reach. */
  maxCryptoShare: number;
  /** How to split money being invested now, in percent. */
  allocation: Array<{ type: InvestmentType; percent: number; why: string }>;
};

export const PROFILE_RULES: Record<RiskProfile, ProfileRules> = {
  PRUDENT: {
    reserveMonths: 6,
    investShareOfSurplus: 0.4,
    maxCryptoShare: 0.05,
    allocation: [
      { type: "EPARGNE", percent: 50, why: "Disponible à tout moment, sans risque de perte." },
      { type: "ETF", percent: 30, why: "Des centaines d'entreprises d'un coup : le risque est réparti." },
      { type: "BUSINESS", percent: 15, why: "iPhones, outils (GeeLark, ComfyUI...) ou chatteurs qui font grandir l'agence." },
      { type: "CRYPTO", percent: 5, why: "Une petite part seulement : ça peut perdre 50 % vite." },
    ],
  },
  EQUILIBRE: {
    reserveMonths: 4,
    investShareOfSurplus: 0.6,
    maxCryptoShare: 0.1,
    allocation: [
      { type: "ETF", percent: 40, why: "La base d'un portefeuille qui grandit sur le long terme." },
      { type: "EPARGNE", percent: 30, why: "Pour les imprévus et les occasions." },
      { type: "BUSINESS", percent: 20, why: "Ce que vous maîtrisez le mieux : iPhones, outils, chatteurs pour l'OFM." },
      { type: "CRYPTO", percent: 10, why: "Du potentiel, mais très volatil : jamais plus que ça." },
    ],
  },
  DYNAMIQUE: {
    reserveMonths: 3,
    investShareOfSurplus: 0.75,
    maxCryptoShare: 0.2,
    allocation: [
      { type: "ETF", percent: 45, why: "Le moteur de croissance principal, à garder des années." },
      { type: "BUSINESS", percent: 25, why: "Réinvestir dans l'OFM (matériel, outils, chatteurs) rapporte souvent le plus." },
      { type: "CRYPTO", percent: 15, why: "Pour viser plus haut, en acceptant de fortes baisses." },
      { type: "EPARGNE", percent: 15, why: "Un coussin, même quand on prend des risques." },
    ],
  },
};

export type AdviceInput = {
  /** Money available right now. */
  available: number;
  /** Average monthly income (share of the agency's net profit). */
  monthlyIncome: number;
  /** Personal living costs per month. */
  monthlyLiving: number;
  /** Everything already invested, at its latest known value, by type. */
  investedByType: Partial<Record<InvestmentType, number>>;
  profile: RiskProfile;
  /** Below this, an amount is too small to split across several investments. */
  smallAmount: number;
};

export type Verdict = "SET_UP" | "BUILD_RESERVE" | "INVEST" | "KEEP";

export type Tip = { tone: "good" | "warn" | "info"; text: string };

export type Advice = {
  verdict: Verdict;
  headline: string;
  reserveTarget: number;
  reserveMissing: number;
  /** Can be invested today without touching the reserve. */
  investableNow: number;
  monthlySurplus: number;
  /** Suggested monthly split of the surplus. */
  monthlyToReserve: number;
  monthlyToInvest: number;
  /** Months until the reserve is full at the current surplus (null if it never fills). */
  monthsToReserve: number | null;
  /** How to split `investableNow`, with amounts. Empty when nothing should be invested now. */
  allocation: Array<{ type: InvestmentType; percent: number; amount: number; why: string }>;
  investedTotal: number;
  tips: Tip[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildAdvice(input: AdviceInput): Advice {
  const rules = PROFILE_RULES[input.profile];
  const available = Math.max(0, input.available);
  const living = Math.max(0, input.monthlyLiving);
  const investedTotal = Object.values(input.investedByType).reduce((sum, v) => sum + Math.max(0, v ?? 0), 0);

  const reserveTarget = living * rules.reserveMonths;
  const reserveMissing = Math.max(0, reserveTarget - available);
  const investableNow = Math.max(0, available - reserveTarget);
  const monthlySurplus = input.monthlyIncome - living;

  let monthlyToReserve = 0;
  let monthlyToInvest = 0;
  if (monthlySurplus > 0) {
    if (reserveMissing > 0) {
      // Reserve first: nearly all of the surplus fills it, a little starts the investing habit.
      monthlyToReserve = Math.min(reserveMissing, monthlySurplus * 0.9);
      monthlyToInvest = monthlySurplus - monthlyToReserve;
    } else {
      monthlyToInvest = monthlySurplus * rules.investShareOfSurplus;
    }
  }
  const monthsToReserve = reserveMissing === 0 ? 0 : monthlyToReserve > 0 ? Math.ceil(reserveMissing / monthlyToReserve) : null;

  const tips: Tip[] = [];
  let verdict: Verdict;
  let headline: string;

  if (living === 0) {
    verdict = "SET_UP";
    headline = "Indiquez vos dépenses personnelles par mois pour recevoir un plan précis.";
  } else if (reserveMissing > 0) {
    verdict = "BUILD_RESERVE";
    headline = "Gardez votre argent : constituez d'abord votre réserve de sécurité.";
    tips.push({
      tone: "warn",
      text: `Une réserve de ${rules.reserveMonths} mois de dépenses vous protège d'un mois sans ventes. N'investissez pas l'argent dont vous pourriez avoir besoin.`,
    });
  } else if (investableNow < input.smallAmount && monthlyToInvest < input.smallAmount) {
    verdict = "KEEP";
    headline = "Votre réserve est prête, mais la somme à investir est encore trop petite.";
    tips.push({
      tone: "info",
      text: "Avec une petite somme, les frais mangent les gains et on ne peut pas diversifier. Accumulez quelques mois, ou investissez-la dans ce qui fait grandir l'agence.",
    });
  } else {
    verdict = "INVEST";
    headline = "Votre réserve est complète : vous pouvez investir le surplus.";
  }

  if (monthlySurplus <= 0 && living > 0) {
    tips.push({
      tone: "warn",
      text: "Vos revenus moyens ne couvrent pas vos dépenses personnelles : réduisez les dépenses ou augmentez les ventes avant de penser à investir.",
    });
  }

  if (investedTotal > 0) {
    const entries = Object.entries(input.investedByType) as Array<[InvestmentType, number]>;
    const [topType, topValue] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const crypto = input.investedByType.CRYPTO ?? 0;
    const tooMuchCrypto = crypto / investedTotal > rules.maxCryptoShare;
    // Too much crypto gets its own, more specific warning below.
    if (topValue / investedTotal > 0.5 && investedTotal >= input.smallAmount && !(topType === "CRYPTO" && tooMuchCrypto)) {
      tips.push({
        tone: "warn",
        text: `${Math.round((topValue / investedTotal) * 100)} % de vos investissements sont en « ${INVESTMENT_TYPE_LABELS[topType]} ». Répartissez davantage : si ça chute, tout chute.`,
      });
    }
    if (tooMuchCrypto) {
      tips.push({
        tone: "warn",
        text: `La crypto représente ${Math.round((crypto / investedTotal) * 100)} % de vos investissements, au-delà des ${Math.round(rules.maxCryptoShare * 100)} % conseillés pour un profil ${RISK_PROFILE_LABELS[input.profile].toLowerCase()}.`,
      });
    }
  }

  if (verdict === "INVEST") {
    tips.push({ tone: "good", text: "Investissez un peu chaque mois plutôt que tout d'un coup : vous lissez les hauts et les bas du marché." });
  }
  tips.push({ tone: "info", text: "N'investissez jamais de l'argent emprunté, ni ce dont vous aurez besoin dans l'année." });

  const allocation =
    verdict === "INVEST" && investableNow >= input.smallAmount
      ? rules.allocation.map((a) => ({ ...a, amount: round2((investableNow * a.percent) / 100) }))
      : [];

  return {
    verdict,
    headline,
    reserveTarget: round2(reserveTarget),
    reserveMissing: round2(reserveMissing),
    investableNow: round2(investableNow),
    monthlySurplus: round2(monthlySurplus),
    monthlyToReserve: round2(monthlyToReserve),
    monthlyToInvest: round2(monthlyToInvest),
    monthsToReserve,
    allocation,
    investedTotal: round2(investedTotal),
    tips,
  };
}
