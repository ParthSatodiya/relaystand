/*
  Warnings:

  - You are about to drop the column `jiraUrl` on the `StandupItem` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "StandupItemLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StandupItemLink_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StandupItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Move every existing Jira URL over as that item's first link, before the
-- column goes away. Ids are preserved by the rebuild below, so these hold.
INSERT INTO "StandupItemLink" ("itemId", "url")
SELECT "id", "jiraUrl" FROM "StandupItem" WHERE "jiraUrl" <> '';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StandupItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "standupId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "carriedFromId" INTEGER,
    "originDate" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StandupItem_standupId_fkey" FOREIGN KEY ("standupId") REFERENCES "Standup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StandupItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StandupItem_carriedFromId_fkey" FOREIGN KEY ("carriedFromId") REFERENCES "StandupItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StandupItem" ("carriedFromId", "comment", "createdAt", "displayOrder", "id", "memberId", "originDate", "standupId", "status", "title", "updatedAt") SELECT "carriedFromId", "comment", "createdAt", "displayOrder", "id", "memberId", "originDate", "standupId", "status", "title", "updatedAt" FROM "StandupItem";
DROP TABLE "StandupItem";
ALTER TABLE "new_StandupItem" RENAME TO "StandupItem";
CREATE INDEX "StandupItem_standupId_idx" ON "StandupItem"("standupId");
CREATE INDEX "StandupItem_memberId_idx" ON "StandupItem"("memberId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StandupItemLink_itemId_idx" ON "StandupItemLink"("itemId");
