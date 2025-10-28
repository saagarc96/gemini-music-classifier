-- CreateTable
CREATE TABLE "songs" (
    "id" SERIAL NOT NULL,
    "isrc" VARCHAR(12) NOT NULL,
    "title" TEXT,
    "artist" TEXT,
    "energy" VARCHAR(20),
    "bpm" INTEGER,
    "subgenre" TEXT,
    "artwork" TEXT,
    "source_file" TEXT,
    "ai_status" VARCHAR(50),
    "ai_error_message" TEXT,
    "ai_reasoning" TEXT,
    "ai_context_used" TEXT,
    "ai_energy" VARCHAR(20),
    "ai_accessibility" VARCHAR(20),
    "ai_subgenre_1" VARCHAR(100),
    "ai_subgenre_2" VARCHAR(100),
    "ai_subgenre_3" VARCHAR(100),
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" VARCHAR(100),
    "reviewed_at" TIMESTAMP(3),
    "curator_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "songs_isrc_key" ON "songs"("isrc");

-- CreateIndex
CREATE INDEX "songs_isrc_idx" ON "songs"("isrc");

-- CreateIndex
CREATE INDEX "idx_subgenre_1" ON "songs"("ai_subgenre_1");

-- CreateIndex
CREATE INDEX "idx_subgenre_2" ON "songs"("ai_subgenre_2");

-- CreateIndex
CREATE INDEX "idx_subgenre_3" ON "songs"("ai_subgenre_3");

-- CreateIndex
CREATE INDEX "idx_status" ON "songs"("ai_status");

-- CreateIndex
CREATE INDEX "songs_reviewed_idx" ON "songs"("reviewed");
