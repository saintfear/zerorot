-- This migration brings the database schema in sync with `prisma/schema.prisma`
-- for the Discovery Engine v2 rollout (managed scraping + multimodal signals).

-- AlterTable
ALTER TABLE "User" ADD COLUMN "instagramCookies" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instagramId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "imageUrl" TEXT,
    "hashtags" TEXT,
    "author" TEXT,
    "score" REAL,
    "rating" INTEGER,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "likeCount" INTEGER,
    "commentCount" INTEGER,
    "viewCount" INTEGER,
    "engagementScore" REAL,
    "imageDescription" TEXT,
    "visionTags" TEXT,
    "embedding" TEXT,
    "embeddingSim" REAL,
    "source" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ContentItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_ContentItem" ("author", "caption", "discoveredAt", "hashtags", "id", "imageUrl", "instagramId", "score", "url", "userId")
SELECT "author", "caption", "discoveredAt", "hashtags", "id", "imageUrl", "instagramId", "score", "url", "userId"
FROM "ContentItem"
WHERE "userId" IS NOT NULL;

DROP TABLE "ContentItem";
ALTER TABLE "new_ContentItem" RENAME TO "ContentItem";

CREATE UNIQUE INDEX "ContentItem_userId_instagramId_key" ON "ContentItem"("userId", "instagramId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

