ALTER TABLE "Workspace"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "publicDescription" TEXT,
  ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
