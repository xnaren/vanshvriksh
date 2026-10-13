# Supabase — run it all inside Codespaces (no supabase.com account needed for dev)

The Supabase CLI runs the entire backend — Postgres, Auth, Studio, and a fake
mail inbox — as Docker containers inside your Codespace.

## Local stack (development)

1. `npm run db:start` (or `npx supabase start`) — first run pulls ~8 Docker
   images, takes a few minutes. It prints the API URL and keys at the end.
2. `npx supabase status` — shows the keys any time. Copy them into
   `.env.local` (see the "Option A / local" block in `.env.example`).
3. `npm run dev` — the app now talks to `http://localhost:54321`.
4. Handy UIs (already port-forwarded by the devcontainer):
   - **Studio** (DB browser): http://localhost:54323
   - **Inbucket** (fake inbox): http://localhost:54324 — OTP codes land here,
     no real emails are sent. Perfect for testing the passwordless login.
5. The baseline schema is applied automatically from `supabase/migrations/`
   on first start. `schema.sql` holds the same content for the hosted path
   below — if you change the schema, update both (or make `migrations/` the
   source of truth and regenerate `schema.sql` from it).
6. `npm run db:reset` — wipe the local DB and re-apply migrations.
   `npm run db:stop` — shut the stack down.

Auth notes for local dev:
- Email OTP works out of the box; read the 6-digit codes in Inbucket.
- Turnstile is skipped locally when its keys are unset (dev-only bypass in
  `lib/turnstile.ts`). Set real keys before deploying anywhere public.

## Going live (hosted Supabase)

When you're ready for real users:

1. Create a project at https://supabase.com/dashboard → **SQL Editor** →
   paste `supabase/schema.sql` → **Run**.
2. **Authentication** → enable the **Email** provider. Add a custom SMTP sender
   before real users arrive, and tighten OTP rate limits.
3. `npx supabase link --project-ref <your-ref>` once, then
   `npm run db:push` applies future migrations from `supabase/migrations/`.
4. Swap `.env.local` / Vercel env vars to the hosted keys (the "Option B"
   block in `.env.example`) and set the real Turnstile keys.
