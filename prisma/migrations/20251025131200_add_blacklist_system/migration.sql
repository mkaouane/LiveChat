-- CreateTable
CREATE TABLE "Blacklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetUserId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AlterTable
ALTER TABLE "Queue" ADD COLUMN "authorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Blacklist_userId_guildId_key" ON "Blacklist"("userId", "guildId");

-- CreateIndex
CREATE INDEX "Blacklist_guildId_idx" ON "Blacklist"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_targetUserId_guildId_voterId_key" ON "Vote"("targetUserId", "guildId", "voterId");

-- CreateIndex
CREATE INDEX "Vote_guildId_idx" ON "Vote"("guildId");

