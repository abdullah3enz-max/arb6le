-- CreateTable
CREATE TABLE "FavoriteAnime" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "externalId" TEXT,
    "favoriteChars" TEXT[],

    CONSTRAINT "FavoriteAnime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "externalId" TEXT,
    "favoriteChars" TEXT[],

    CONSTRAINT "FavoriteGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteAnime_userId_idx" ON "FavoriteAnime"("userId");

-- CreateIndex
CREATE INDEX "FavoriteGame_userId_idx" ON "FavoriteGame"("userId");

-- AddForeignKey
ALTER TABLE "FavoriteAnime" ADD CONSTRAINT "FavoriteAnime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteGame" ADD CONSTRAINT "FavoriteGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
