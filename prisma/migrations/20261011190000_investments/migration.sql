-- CreateTable
CREATE TABLE "InvestmentProfile" (
    "userId" TEXT NOT NULL,
    "monthlyLivingMinor" BIGINT NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "riskProfile" TEXT NOT NULL DEFAULT 'EQUILIBRE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currentValueMinor" BIGINT,
    "currencyCode" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Investment_userId_idx" ON "Investment"("userId");

-- AddForeignKey
ALTER TABLE "InvestmentProfile" ADD CONSTRAINT "InvestmentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

