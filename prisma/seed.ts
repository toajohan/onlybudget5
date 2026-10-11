import { PrismaClient, FeeType, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@onlybudget.local";

async function main() {
  // --- Devises --- (taux provisoires, à corriger dans Paramètres > Devises)
  await prisma.currency.upsert({
    where: { code: "MGA" },
    update: {},
    create: { code: "MGA", symbol: "Ar", name: "Ariary", rateToBase: 1, isBase: true },
  });
  await prisma.currency.upsert({
    where: { code: "EUR" },
    update: {},
    create: { code: "EUR", symbol: "€", name: "Euro", rateToBase: 4900 }, // 1 EUR ≈ 4900 Ar — À CORRIGER
  });
  await prisma.currency.upsert({
    where: { code: "USD" },
    update: {},
    create: { code: "USD", symbol: "$", name: "Dollar US", rateToBase: 4500 }, // 1 USD ≈ 4500 Ar — À CORRIGER
  });

  // --- Comptes / "maisons d'argent" ---
  const onlyChat = await prisma.wallet.upsert({
    where: { id: "seed-onlychat" },
    update: {},
    create: { id: "seed-onlychat", name: "OnlyChat", icon: "Heart", currencyCode: "EUR", isSource: true },
  });
  const paypal = await prisma.wallet.upsert({
    where: { id: "seed-paypal" },
    update: {},
    create: { id: "seed-paypal", name: "PayPal", icon: "CreditCard", currencyCode: "EUR", isSource: true },
  });
  const binance = await prisma.wallet.upsert({
    where: { id: "seed-binance" },
    update: {},
    create: { id: "seed-binance", name: "Binance", icon: "Bitcoin", currencyCode: "USD" },
  });
  const banque = await prisma.wallet.upsert({
    where: { id: "seed-banque" },
    update: {},
    create: { id: "seed-banque", name: "Banque", icon: "Landmark", currencyCode: "USD" },
  });
  const mvola = await prisma.wallet.upsert({
    where: { id: "seed-mvola" },
    update: {},
    create: { id: "seed-mvola", name: "Mvola", icon: "Smartphone", currencyCode: "MGA" },
  });

  // --- Chemins de retrait --- (0% par défaut, à configurer avec vos vrais frais dans Paramètres > Trésorerie)
  const routes: [string, string][] = [
    [onlyChat.id, binance.id],
    [paypal.id, binance.id],
    [binance.id, banque.id],
    [banque.id, mvola.id],
  ];
  for (const [fromWalletId, toWalletId] of routes) {
    await prisma.walletRoute.upsert({
      where: { fromWalletId_toWalletId: { fromWalletId, toWalletId } },
      update: {},
      create: { fromWalletId, toWalletId, feeType: FeeType.NONE },
    });
  }

  // --- Catégories de dépenses ---
  const categories = [
    { name: "Abonnement / Outils", icon: "Wrench" },
    { name: "Loyer", icon: "Home" },
    { name: "Nourriture", icon: "UtensilsCrossed" },
    { name: "Provision", icon: "PiggyBank" },
    { name: "Autre", icon: "MoreHorizontal" },
  ];
  for (const category of categories) {
    const existing = await prisma.expenseCategory.findFirst({ where: { name: category.name } });
    if (!existing) {
      await prisma.expenseCategory.create({ data: category });
    }
  }

  // --- Compte associé de démarrage --- (uniquement s'il n'existe pas déjà : mot de passe généré une seule fois)
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existingAdmin) {
    const generatedPassword = randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    await prisma.user.create({
      data: {
        name: "Admin",
        email: ADMIN_EMAIL,
        passwordHash,
        role: Role.ASSOCIE,
        profitSharePercent: 50,
        mustChangePassword: true,
      },
    });

    console.log("\n=================================================");
    console.log(" Compte associé de démarrage créé :");
    console.log(`   Email        : ${ADMIN_EMAIL}`);
    console.log(`   Mot de passe : ${generatedPassword}`);
    console.log(" -> Notez ce mot de passe maintenant : il ne sera plus jamais réaffiché.");
    console.log(" -> Changez-le dès la première connexion (page Profil).");
    console.log(" -> Ajoutez votre second associé et vos chatteurs depuis la page Équipe.");
    console.log(" -> Corrigez les taux de change dans Paramètres > Devises.");
    console.log("=================================================\n");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
