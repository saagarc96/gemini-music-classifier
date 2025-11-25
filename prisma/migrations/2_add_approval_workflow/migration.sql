-- Add approval workflow columns to songs table
ALTER TABLE songs
ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
ADD COLUMN approved_by VARCHAR(100),
ADD COLUMN approved_by_id TEXT,
ADD COLUMN approved_at TIMESTAMP;

-- Create index for approval status filtering
CREATE INDEX idx_approval_status ON songs(approval_status);

-- Create index for approved_by_id
CREATE INDEX idx_approved_by_id ON songs(approved_by_id);

-- Add foreign key constraint for approver
ALTER TABLE songs
ADD CONSTRAINT fk_approved_by_user
FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL;
