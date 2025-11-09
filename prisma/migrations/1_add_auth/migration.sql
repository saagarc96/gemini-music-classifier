-- CreateEnum for Role
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CURATOR');

-- CreateTable for users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CURATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for users
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Add columns if they don't already exist
-- Do one at a time so IF NOT EXISTS works properly
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='spotify_track_id') THEN
        ALTER TABLE "songs" ADD COLUMN "spotify_track_id" VARCHAR(50);
        CREATE INDEX "idx_spotify_track_id" ON "songs"("spotify_track_id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='reviewed_by_id') THEN
        ALTER TABLE "songs" ADD COLUMN "reviewed_by_id" TEXT;
        CREATE INDEX "idx_reviewed_by_id" ON "songs"("reviewed_by_id");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='songs' AND column_name='created_by_id') THEN
        ALTER TABLE "songs" ADD COLUMN "created_by_id" TEXT;
        CREATE INDEX "idx_created_by_id" ON "songs"("created_by_id");
    END IF;
END $$;

-- Add foreign keys if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name='songs_reviewed_by_id_fkey'
    ) THEN
        ALTER TABLE "songs" ADD CONSTRAINT "songs_reviewed_by_id_fkey"
            FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name='songs_created_by_id_fkey'
    ) THEN
        ALTER TABLE "songs" ADD CONSTRAINT "songs_created_by_id_fkey"
            FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
