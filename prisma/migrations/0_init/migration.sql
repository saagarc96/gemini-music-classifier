-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CURATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

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
    "spotify_track_id" VARCHAR(50),
    "ai_status" VARCHAR(50),
    "ai_error_message" TEXT,
    "ai_reasoning" TEXT,
    "ai_context_used" TEXT,
    "ai_energy" VARCHAR(20),
    "ai_accessibility" VARCHAR(20),
    "ai_explicit" VARCHAR(20),
    "ai_subgenre_1" VARCHAR(100),
    "ai_subgenre_2" VARCHAR(100),
    "ai_subgenre_3" VARCHAR(100),
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" VARCHAR(100),
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "curator_notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "songs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for users
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex for songs
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

-- CreateIndex
CREATE INDEX "idx_spotify_track_id" ON "songs"("spotify_track_id");

-- CreateIndex
CREATE INDEX "idx_reviewed_by_id" ON "songs"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "idx_created_by_id" ON "songs"("created_by_id");

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
