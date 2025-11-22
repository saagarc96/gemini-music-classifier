# Safe Database Migration Skill

Guide me through performing a safe database migration on the production database, following best practices to minimize risk.

## Instructions

When this skill is invoked, you should:

1. **Understand the Migration Intent**
   - Ask the user what schema changes they want to make
   - Identify if this is a low-risk (additive) or high-risk (destructive) change
   - Examples:
     - Low-risk: Adding new table, adding nullable column, creating index
     - High-risk: Removing columns, changing data types, renaming tables

2. **Pre-Migration Checklist**
   - Verify current working directory is the project root
   - Check git status to ensure uncommitted changes won't be lost
   - Create production backup: `npm run prod:backup`
   - Verify backup was created: `ls -lh backups/` and confirm recent .sql file exists

3. **Create and Test Migration**
   - Guide user to edit `prisma/schema.prisma` with their desired changes
   - Generate migration: `npx prisma migrate dev --name [descriptive_name]`
   - Test on dev database:
     ```bash
     npm run dev:db:start
     npm run dev:migrate
     npm run dev:studio
     ```
   - Review generated SQL in `prisma/migrations/[timestamp]_[name]/migration.sql`
   - Check for dangerous operations:
     - `DROP TABLE` or `DROP COLUMN` (data loss)
     - `ALTER COLUMN ... SET NOT NULL` without default (will fail on existing rows)
     - Complex multi-table changes

4. **Risk Assessment and Strategy**

   **For Low-Risk Changes (Additive):**
   - Can proceed with single-phase migration
   - Apply directly: `npx prisma migrate deploy`

   **For High-Risk Changes (Destructive):**
   - Recommend multi-phase approach:
     - Phase 1: Add new structure (don't remove old yet)
     - Phase 2: Migrate data
     - Phase 3: Remove old structure (after verification)
   - Show example for their specific case

5. **Execute Migration**
   - Confirm user is ready to proceed
   - For low-risk: `npx prisma migrate deploy`
   - For high-risk: Guide through each phase with verification steps
   - After each phase, verify:
     ```bash
     npx prisma studio  # Check production schema
     ```

6. **Post-Migration Verification**
   - Test the review interface:
     - Open http://localhost:3000
     - Verify songs load
     - Test filters work
     - Try editing a song
     - Check browser console for errors
   - Check Vercel logs if deployed: `vercel logs --follow`
   - Run a test query if applicable:
     ```bash
     node -e "
     const { PrismaClient } = require('@prisma/client');
     const prisma = new PrismaClient();
     prisma.song.findFirst().then(console.log).catch(console.error);
     "
     ```

7. **Document and Commit**
   - Add migration files to git:
     ```bash
     git add prisma/migrations/ prisma/schema.prisma
     git commit -m "feat: [migration description]"
     ```
   - Update CLAUDE.md if this changes how the system works
   - Create backup retention note if this is a major change

8. **Emergency Rollback (Only if Issues Occur)**
   If something goes wrong:
   ```bash
   # Quick rollback
   npm run prod:backup  # Backup current (broken) state first
   cat backups/prod_backup_[before_migration_timestamp].sql | \
     psql "$POSTGRES_URL_NON_POOLING"

   # Verify rollback
   npx prisma studio
   ```

## Common Migration Patterns to Reference

### Adding Required Column to Existing Table
**Problem:** Can't add `NOT NULL` column to table with existing rows.

**Solution:**
```prisma
// Step 1: Add as nullable
model Song {
  new_field String?  // Nullable first
}
// Migrate, then populate data...

// Step 2: Make required later
model Song {
  new_field String  // Remove ? after data populated
}
```

### Changing Column Type
**Problem:** Direct type change may fail on existing data.

**Solution:**
1. Add new column with new type
2. Migrate data with transformation
3. Drop old column
4. Update app to use new column name

### Renaming Column
**Problem:** Prisma generates DROP + ADD, losing data!

**Solution:**
```sql
-- Manually edit migration.sql after generating:
ALTER TABLE "Song" RENAME COLUMN "old_name" TO "new_name";
```

## Key Files to Reference

- `docs/other/production-migration-practices.md` - Complete migration guide
- `prisma/schema.prisma` - Database schema
- `prisma/migrations/` - Migration history
- `backups/` - Production backups

## Safety Reminders

- ✅ Always backup before migrations (`npm run prod:backup`)
- ✅ Test on dev database first (`npm run dev:migrate`)
- ✅ Review generated SQL for dangerous operations
- ✅ Use multi-phase approach for destructive changes
- ✅ Verify application works after migration
- ✅ Keep backups for 7+ days before deleting
- ⚠️ Vercel serverless always connects to production database
- ⚠️ Changes at localhost:3000 affect production immediately

## Example Workflow

```bash
# 1. Backup
npm run prod:backup

# 2. Edit schema
# vim prisma/schema.prisma

# 3. Create migration
npx prisma migrate dev --name add_playlist_table

# 4. Test on dev
npm run dev:db:start
npm run dev:migrate
npm run dev:studio

# 5. Review SQL
cat prisma/migrations/*/migration.sql

# 6. Apply to production
npx prisma migrate deploy

# 7. Verify
npx prisma studio
# Test app at localhost:3000

# 8. Commit
git add prisma/
git commit -m "feat: add playlist tracking"
```
