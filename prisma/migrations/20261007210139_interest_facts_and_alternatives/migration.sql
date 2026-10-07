-- AlterEnum
ALTER TYPE "ConnectionStatus" ADD VALUE 'ALTERNATIVE';

-- CreateTable
CREATE TABLE "InterestFact" (
    "id" TEXT NOT NULL,
    "interestKey" TEXT NOT NULL,
    "interest" TEXT NOT NULL,
    "worldCategory" "WorldCategory" NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "shortForm" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterestFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestRetrieval" (
    "interestKey" TEXT NOT NULL,
    "interest" TEXT NOT NULL,
    "factCount" INTEGER NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterestRetrieval_pkey" PRIMARY KEY ("interestKey")
);

-- CreateIndex
CREATE INDEX "InterestFact_interestKey_idx" ON "InterestFact"("interestKey");
