-- Org layer: every team now lives inside an org, membership of which is
-- approved by an admin. Existing teams are adopted by an org created for
-- whoever made them, and every current team member joins it as active, so
-- nobody loses a board on deploy.

-- CreateTable
CREATE TABLE "Org" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoPath" TEXT NOT NULL DEFAULT '',
    "emailDomain" TEXT NOT NULL DEFAULT '',
    "createdBy" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Org_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Org_slug_key" ON "Org"("slug");

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orgId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrgMember_orgId_email_key" ON "OrgMember"("orgId", "email");
CREATE INDEX "OrgMember_email_idx" ON "OrgMember"("email");

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orgId" INTEGER NOT NULL,
    "teamId" INTEGER,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AuditEvent_orgId_createdAt_idx" ON "AuditEvent"("orgId", "createdAt");
CREATE INDEX "AuditEvent_teamId_createdAt_idx" ON "AuditEvent"("teamId", "createdAt");

-- Backfill: one org per person who has already created a team.
INSERT INTO "Org" ("name", "slug", "createdBy")
SELECT
    COALESCE(NULLIF(u."fullName", ''), u."email") || '''s org',
    lower(replace(replace(substr(u."email", 1, instr(u."email", '@') - 1), '.', '-'), '_', '-')) || '-' || u."id",
    u."id"
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Team" t WHERE t."createdBy" = u."id");

-- The creator runs their org.
INSERT INTO "OrgMember" ("orgId", "email", "name", "role", "status")
SELECT o."id", u."email", COALESCE(NULLIF(u."fullName", ''), u."email"), 'admin', 'active'
FROM "Org" o JOIN "User" u ON u."id" = o."createdBy";

-- Everyone already on one of its teams is already working here.
INSERT OR IGNORE INTO "OrgMember" ("orgId", "email", "name", "role", "status")
SELECT DISTINCT o."id", tm."email", tm."name", 'member', 'active'
FROM "TeamMember" tm
JOIN "Team" t ON t."id" = tm."teamId"
JOIN "Org" o ON o."createdBy" = t."createdBy";

-- "dev" was always a bad name for a standup that includes QA.
UPDATE "TeamMember" SET "role" = 'member' WHERE "role" = 'dev';

-- RedefineTables: Team gains a required orgId.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orgId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Team_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("id", "orgId", "name", "createdBy", "createdAt")
SELECT t."id", o."id", t."name", t."createdBy", t."createdAt"
FROM "Team" t JOIN "Org" o ON o."createdBy" = t."createdBy";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";

CREATE INDEX "TeamMember_email_idx" ON "TeamMember"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
