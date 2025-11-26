# Subgenre Management UI - Revised Implementation Plan

## Overview

Admin-only UI to manage subgenres via database storage (not file-based). This resolves the Vercel read-only filesystem limitation and provides a production-ready solution.

## Key Changes from Original Plan

| Original Plan | Revised Plan |
|---------------|--------------|
| File-based (`data/subgenres.json`) | Database storage (new `Subgenre` + `Category` tables) |
| Git commit button | Removed (not needed with DB) |
| `requireAdmin(req)` (wrong signature) | `requireAdmin(req, res)` (matches existing pattern) |
| `export async function GET/PUT` | Single `export default function handler` |
| `ProtectedRoute` component | Role check in App.tsx + component-level `user?.role === 'ADMIN'` |

---

## Database Schema

Add to `prisma/schema.prisma`:

```prisma
model SubgenreCategory {
  id         String     @id @default(cuid())
  name       String     @unique @db.VarChar(100)
  sortOrder  Int        @default(0) @map("sort_order")
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @updatedAt @map("updated_at")

  subgenres  Subgenre[]

  @@map("subgenre_categories")
}

model Subgenre {
  id         String   @id @default(cuid())
  name       String   @db.VarChar(100)
  categoryId String   @map("category_id")
  sortOrder  Int      @default(0) @map("sort_order")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  category   SubgenreCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([name])
  @@index([categoryId])
  @@map("subgenres")
}
```

## Migration Script

Create `scripts/migrate-subgenres-to-db.cjs` to seed database from existing `data/subgenres.json`:

```javascript
// Read data/subgenres.json
// For each category: create SubgenreCategory
// For each subgenre in category: create Subgenre with FK
```

---

## API Endpoints

### GET /api/admin/subgenres

File: `api/admin/subgenres.ts`

```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // Public read - anyone can fetch subgenres for dropdowns
    const categories = await prisma.subgenreCategory.findMany({
      include: { subgenres: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' }
    });
    return res.json({ categories });
  }

  if (req.method === 'PUT') {
    // Admin only - update entire structure
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { categories } = req.body;
    // Validate and upsert categories/subgenres
    // Return updated structure
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

### POST /api/admin/subgenres/category

File: `api/admin/subgenres/category.ts`

- Create new category
- Admin only

### DELETE /api/admin/subgenres/[id]

File: `api/admin/subgenres/[id].ts`

- Delete subgenre by ID
- Admin only
- Validate: warn if subgenre is in use by songs

---

## Frontend Components

### 1. SubgenresPage (`client/src/pages/SubgenresPage.tsx`)

Main admin page with:
- Category tabs (using shadcn Tabs)
- List of subgenres per category
- Add subgenre input + button
- Delete (X) buttons per subgenre
- Unsaved changes indicator
- Save button

### 2. App.tsx Route Addition

```tsx
// In the Routes section, add:
<Route path="/admin/subgenres" element={<SubgenresPage />} />
```

Note: No ProtectedRoute wrapper needed. The page itself checks `user?.role === 'ADMIN'` and redirects or shows unauthorized message.

### 3. Header.tsx Navigation

```tsx
// Add admin link conditionally
{user?.role === 'ADMIN' && (
  <Link to="/admin/subgenres" className="...">
    Manage Subgenres
  </Link>
)}
```

---

## Data Sync Strategy

Since songs store subgenre values as VARCHAR (not FK), we need to handle the case where a subgenre is deleted but songs still reference it.

**Decision: Block deletion if in use**

If any songs reference a subgenre, prevent deletion with a clear error:
> "Cannot delete 'Afro-House' - 47 songs use this subgenre. Reassign them first."

This is the safest approach - no orphaned data, admin must consciously handle affected songs.

---

## File & Backend Sync Strategy

**Decision: Database is source of truth, JSON is auto-generated cache**

The flow:
1. **Database** = single source of truth (edited via admin UI)
2. **`data/subgenres.json`** = auto-generated from DB when admin saves
3. **`client/src/data/constants.ts`** = auto-generated from DB when admin saves
4. **Backend scripts** (`subgenre-loader.cjs`) = read JSON (unchanged, works as before)
5. **Frontend components** = fetch from API, fall back to constants.ts

**On Admin Save:**
The PUT endpoint regenerates both files after updating DB:
```typescript
// After DB update succeeds:
await regenerateSubgenreFiles(); // writes JSON + constants.ts
```

This gives us:
- Single source of truth (DB)
- Backend enrichment scripts work unchanged (read JSON)
- Frontend has fresh data from API with constants.ts fallback
- No manual file editing ever needed

---

## Implementation Steps

### Phase 1: Database Setup
1. Add Prisma schema for `SubgenreCategory` and `Subgenre` models
2. Run migration: `npm run prisma:migrate`
3. Create seed script to migrate data from `data/subgenres.json`
4. Run seed script

### Phase 2: Backend API
1. Create `api/admin/subgenres.ts` - GET (public) and PUT (admin)
2. Create `api/admin/subgenres/[id].ts` - DELETE (admin)
3. Add usage check query (count songs using subgenre)

### Phase 3: Frontend Page
1. Create `SubgenresPage.tsx` with category tabs UI
2. Add route to `App.tsx`
3. Add navigation link to `Header.tsx`
4. Implement add/delete/save functionality

### Phase 4: Integration
1. Update FilterPanel to fetch subgenres from API
2. Update ReviewModal to fetch subgenres from API
3. Add fallback to constants.ts for reliability
4. Test full workflow

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add SubgenreCategory and Subgenre models |
| `api/admin/subgenres.ts` | New file - GET/PUT endpoints |
| `api/admin/subgenres/[id].ts` | New file - DELETE endpoint |
| `client/src/pages/SubgenresPage.tsx` | New file - Admin UI page |
| `client/src/App.tsx` | Add route for /admin/subgenres |
| `client/src/components/Header.tsx` | Add admin nav link |
| `client/src/components/FilterPanel.tsx` | Fetch subgenres from API |
| `client/src/components/ReviewModal.tsx` | Fetch subgenres from API |
| `scripts/migrate-subgenres-to-db.cjs` | New file - Migration script |

---

## Validation Rules

When adding/updating subgenres:
- Name cannot be empty or whitespace-only
- Name must be unique (case-insensitive check)
- No leading/trailing whitespace (auto-trim)
- Category name cannot be empty
