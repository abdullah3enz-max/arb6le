/*
  Warnings:

  - You are about to drop the column `headline` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the column `memoryHook` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the column `relationExplain` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Connection` table. All the data in the column will be lost.
  - Added the required column `associationLevel` to the `Connection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `atomEmoji` to the `Connection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `atomLabel` to the `Connection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bridgeLine` to the `Connection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `whyOneLiner` to the `Connection` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AssociationLevel" AS ENUM ('DIRECT_MATCH', 'PHONETIC', 'VISUAL', 'FAMOUS_ASSOCIATION', 'CONTEXTUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorldCategory" ADD VALUE 'CARS';
ALTER TYPE "WorldCategory" ADD VALUE 'MUSIC';
ALTER TYPE "WorldCategory" ADD VALUE 'PEOPLE';

-- AlterTable
ALTER TABLE "Concept" ADD COLUMN     "atomEmoji" TEXT NOT NULL DEFAULT '🧠',
ADD COLUMN     "atomLabel" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Connection" DROP COLUMN "headline",
DROP COLUMN "memoryHook",
DROP COLUMN "relationExplain",
DROP COLUMN "type",
ADD COLUMN     "associationLevel" "AssociationLevel" NOT NULL,
ADD COLUMN     "atomEmoji" TEXT NOT NULL,
ADD COLUMN     "atomLabel" TEXT NOT NULL,
ADD COLUMN     "bridgeLine" TEXT NOT NULL,
ADD COLUMN     "whyOneLiner" TEXT NOT NULL;

-- DropEnum
DROP TYPE "ConnectionType";

-- CreateTable
CREATE TABLE "FavoriteCar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,

    CONSTRAINT "FavoriteCar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteMusic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,

    CONSTRAINT "FavoriteMusic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoritePerson" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,

    CONSTRAINT "FavoritePerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteCar_userId_idx" ON "FavoriteCar"("userId");

-- CreateIndex
CREATE INDEX "FavoriteMusic_userId_idx" ON "FavoriteMusic"("userId");

-- CreateIndex
CREATE INDEX "FavoritePerson_userId_idx" ON "FavoritePerson"("userId");

-- AddForeignKey
ALTER TABLE "FavoriteCar" ADD CONSTRAINT "FavoriteCar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteMusic" ADD CONSTRAINT "FavoriteMusic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritePerson" ADD CONSTRAINT "FavoritePerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
