-- Add approval workflow fields to songs table
ALTER TABLE "songs" ADD COLUMN "approval_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE "songs" ADD COLUMN "approved_by" VARCHAR(100);
ALTER TABLE "songs" ADD COLUMN "approved_by_id" TEXT;
ALTER TABLE "songs" ADD COLUMN "approved_at" TIMESTAMP(3);

-- Add foreign key constraint for approver
ALTER TABLE "songs" ADD CONSTRAINT "songs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for filtering by approval status
CREATE INDEX "idx_approval_status" ON "songs"("approval_status");
CREATE INDEX "idx_approved_by_id" ON "songs"("approved_by_id");
