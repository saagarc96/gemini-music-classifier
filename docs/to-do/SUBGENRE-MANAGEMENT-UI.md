# Subgenre Management UI

## Overview

Admin-only UI to manage subgenres without requiring CLI access or manual git commits. Uses the existing file-based system (`data/subgenres.json`) with a form-based editor.

## Timeline: ~3 days

## Architecture Decision

**Approach: File-Based Form Editor**

- Edit `data/subgenres.json` directly via API
- Auto-regenerate `client/src/data/constants.ts` on save
- Optional git commit button
- No database changes needed
- Songs store subgenres as VARCHAR - no FK constraints to update

## Implementation Plan

### Day 1: Backend API

Create `api/admin/subgenres.ts`:

```typescript
import { requireAdmin } from '../middleware/auth';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const SUBGENRES_PATH = path.join(process.cwd(), 'data/subgenres.json');

// GET /api/admin/subgenres - Read current subgenres
export async function GET(req: Request) {
  await requireAdmin(req);
  const data = await fs.readFile(SUBGENRES_PATH, 'utf-8');
  return Response.json(JSON.parse(data));
}

// PUT /api/admin/subgenres - Update subgenres
export async function PUT(req: Request) {
  await requireAdmin(req);
  const body = await req.json();

  // Validate structure
  if (!body.categories || !Array.isArray(body.categories)) {
    return Response.json({ error: 'Invalid structure' }, { status: 400 });
  }

  // Write to file
  await fs.writeFile(SUBGENRES_PATH, JSON.stringify(body, null, 2));

  // Regenerate constants
  execSync('npm run generate:constants', { cwd: process.cwd() });

  return Response.json({ success: true, message: 'Subgenres updated and constants regenerated' });
}

// POST /api/admin/subgenres/commit - Optional git commit
export async function POST(req: Request) {
  await requireAdmin(req);
  const { message } = await req.json();

  try {
    execSync(`git add data/subgenres.json client/src/data/constants.ts`, { cwd: process.cwd() });
    execSync(`git commit -m "${message || 'Update subgenres'}"`, { cwd: process.cwd() });
    execSync('git push', { cwd: process.cwd() });
    return Response.json({ success: true, message: 'Changes committed and pushed' });
  } catch (error) {
    return Response.json({ error: 'Git operation failed', details: error.message }, { status: 500 });
  }
}
```

### Day 2: Frontend UI

Create `client/src/pages/admin/SubgenresPage.tsx`:

```
+------------------------------------------------------------------+
|  Subgenre Management                              [Commit & Push] |
+------------------------------------------------------------------+
| [Pop/Rock] [Electronic] [Hip-Hop] [Jazz] [Classical] [World] ... |
+------------------------------------------------------------------+
|                                                                   |
|  Pop/Rock (24 subgenres)                                         |
|  +---------------------------------------------------------+     |
|  | Adult Contemporary          [x]                          |     |
|  | Alternative Rock            [x]                          |     |
|  | Classic Rock                [x]                          |     |
|  | Indie Pop                   [x]                          |     |
|  | Modern Latin Pop            [x]                          |     |
|  | ...                                                      |     |
|  +---------------------------------------------------------+     |
|                                                                   |
|  [+ Add Subgenre]                                                |
|  +---------------------------+                                   |
|  | New subgenre name: [____] |  [Add]                           |
|  +---------------------------+                                   |
|                                                                   |
|                                              [Save Changes]       |
+------------------------------------------------------------------+
```

Key components:
- Category tabs using shadcn Tabs
- List of subgenres per category with delete (X) buttons
- Add subgenre input field per category
- Save Changes button (calls PUT endpoint)
- Commit & Push button (calls POST endpoint)
- Unsaved changes indicator

### Day 3: Integration & Testing

1. **Add route to App.tsx:**
```tsx
<Route path="/admin/subgenres" element={
  <ProtectedRoute requiredRole="ADMIN">
    <SubgenresPage />
  </ProtectedRoute>
} />
```

2. **Add navigation to Header.tsx:**
```tsx
{user?.role === 'ADMIN' && (
  <Link to="/admin/subgenres">Manage Subgenres</Link>
)}
```

3. **Testing checklist:**
- [ ] Load existing subgenres
- [ ] Add new subgenre to category
- [ ] Delete subgenre from category
- [ ] Save changes (verify constants.ts updated)
- [ ] Commit & push (verify git operations)
- [ ] Non-admin users cannot access
- [ ] Page refresh shows saved changes

## User Workflow

1. Navigate to Admin > Manage Subgenres
2. Click category tab (e.g., "World & Regional")
3. Type new subgenre name in input field
4. Click "Add" button
5. Click "Save Changes" to update files
6. (Optional) Click "Commit & Push" to deploy

## Notes

- Categories are preserved from current structure (10 total)
- Total subgenres: 180 (as of last update)
- No database migration needed
- Changes require Vercel redeploy to appear in production
- The "Commit & Push" button triggers auto-deploy on Vercel
