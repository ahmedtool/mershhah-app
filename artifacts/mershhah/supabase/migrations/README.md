# Migrations

This folder is the single source of truth for schema/RLS history. It replaces
~67 loose `.sql` files that used to sit scattered across the repo root and
`artifacts/mershhah/` with no ordering or record of what had actually been
run against the live database.

## How this folder was built (2026-09-11)

Every existing `.sql` file was renamed to `<YYYYMMDDHHMMSS>_<original name>.sql`
using each file's **first git commit date** (not filesystem mtime, which resets
on any checkout/clone) as the timestamp, then moved here in that order.
**Content was not edited, deduplicated, or "cleaned up"** — several later files
in this sequence intentionally supersede or narrow earlier ones on the same
table (for example `fix_profiles_admin_rls_recursion.sql` replaces a policy
`mershhah_schema.sql` first created), the same way any real migration history
looks. Reordering and renaming was purely mechanical; verifying that the
*current live database* actually matches this sequence end-to-end was out of
scope for the reorganization itself.

Two files were deliberately **not** brought in here because they aren't
migrations - they stayed at the repo root:
- `check_privilege_escalation_fix_status.sql` - a read-only diagnostic query
- `cleanup_duplicate_google_account.sql` - a one-time data fix scoped to one
  specific user's account, not a repeatable schema change

## Going forward

New schema/RLS/function changes should be added here as a new file named
`<YYYYMMDDHHMMSS>_<short_description>.sql` (UTC or local time, just needs to
sort after the last file). Until this project is fully wired up to
`supabase link` + `supabase db push`, keep running new migrations the same way
they've always been run: paste the file's contents into the Supabase Dashboard
SQL Editor yourself. The file still gets added here afterward so the history
stays complete and ordered - that's the actual point of this folder.
