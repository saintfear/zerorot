-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "preferences" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instagramId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "imageUrl" TEXT,
    "hashtags" TEXT,
    "author" TEXT,
    "score" REAL,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    CONSTRAINT "ContentItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Newsletter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    CONSTRAINT "Newsletter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsletterItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "newsletterId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "NewsletterItem_newsletterId_fkey" FOREIGN KEY ("newsletterId") REFERENCES "Newsletter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NewsletterItem_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_instagramId_key" ON "ContentItem"("instagramId");
