### Firebase → Supabase migration

This utility copies Firestore documents into Supabase Postgres tables using a configurable mapping.

Setup:
- Create a `.env` at the repo root with:
  - `SUPABASE_URL=...`
  - `SUPABASE_SERVICE_ROLE_KEY=...`
  - `FIREBASE_SERVICE_ACCOUNT_PATH=secrets/firebase-service-account.json` (absolute or relative to repo root)
  - `FIREBASE_PROJECT_ID=your-firebase-project-id`
- Put your Firebase Admin SDK service account JSON at the path you set in `FIREBASE_SERVICE_ACCOUNT_PATH`.
- Copy `mapping.example.json` to `mapping.json` and adjust table/field mapping as needed to match your Supabase schema.

Run:
- Dry-run (no writes): `npm run migrate:firebase:dry`
- Execute: `npm run migrate:firebase`

Notes:
- Upserts are used. Set `onConflict` to your table's unique/primary key in `mapping.json`.
- Firestore Timestamps are converted to ISO strings.
- Auth passwords cannot be migrated. Migrate identities separately (e.g., import emails into Supabase and send password reset/invite).
- If you have Storage files in Firebase, migrate them separately (download + `supabase.storage.from(...).upload`).

