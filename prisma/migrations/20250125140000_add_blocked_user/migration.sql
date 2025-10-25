-- CreateTable
CREATE TABLE "BlockedUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "blockedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockedUser_userId_guildId_key" ON "BlockedUser"("userId", "guildId");

-- CreateIndex
CREATE INDEX "BlockedUser_guildId_idx" ON "BlockedUser"("guildId");
