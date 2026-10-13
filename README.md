# 🌳 VanshVriksh — वंशवृक्ष

A collaborative family tree web app built for Indian families — with **gotra**,
family names, and native place on every person, and members added the way
families actually talk about relations: father, mother, husband, wife, son,
daughter, brother, sister.

**Baseline MVP** — passwordless auth, tree CRUD, relation-based adding, a simple
pedigree view, and invite links. Nothing more, nothing less.

## Architecture (in words)

```
Browser ──► Next.js 14 (App Router, TypeScript, Tailwind)
                │  Server Components + Server Actions
                ▼
           Supabase
           ├── Postgres (tables + Row Level Security)
           ├── Auth (passwordless email OTP)
           └── (Realtime ready for live-collaboration later)
```

- **Frontend:** Next.js App Router. Pages are Server Components; mutations are
  Server Actions. Styling is Tailwind.
- **Backend:** Supabase = managed Postgres + Auth. All data access goes through
  Row Level Security policies — members read their trees, editors+ write,
  owners manage. The service-role key is used only inside server actions for
  username→email lookups and profile creation; it never reaches the browser.
- **Auth flow:** username → Cloudflare Turnstile bot-check → 6-digit email OTP.
  The full email address never leaves the server (only a masked hint like
  `r***@gmail.com` is shown). Captcha runs *before* any OTP is sent, so bots
  can't burn email quota.
- **Dev environment:** a `devcontainer.json` defines a Docker container (Node
  20) — open the repo in GitHub Codespaces and you get a full dev environment
  in the browser. Nothing installed locally.
- **Deploy:** Vercel, git-push-to-deploy.

## What's IN the baseline

- Passwordless auth (username + Turnstile CAPTCHA + email OTP)
- Create / view family trees; owner / editor / viewer roles
- Add members via relation picker (8 relations) — parent links, spouse links,
  and sibling links wired automatically
- Indianized fields: gotra, family name, native place, living/deceased
- Simple nested pedigree view
- Invite links (single-use, 30-day expiry)

## What's OUT (later phases)

- Cross-tree search / person discovery
- Duplicate-person merging
- Graph layout for intermarried joint families (data model already supports it)
- Hindi UI, SMS OTP (needs India DLT registration), public trees, photo uploads

## Setup — everything in the browser

### 1. Push to GitHub
```bash
cd vanshvriksh
git init && git add . && git commit -m "VanshVriksh baseline MVP"
gh repo create vanshvriksh --public --source=. --push
```
(Or create the repo on github.com and push manually.)

### 2. Open in Codespaces
On the repo page → **Code** → **Codespaces** → **Create codespace on main**.
The dev container installs dependencies automatically (`npm install`).

### 3. Start the backend (inside Codespaces — no Supabase account needed)
```bash
npm run db:start
```
This spins up Postgres + Auth + Studio + a fake mail inbox as Docker
containers. First run pulls images (a few minutes). Then:
```bash
npx supabase status   # copy the API URL + keys
```
See [`supabase/README.md`](supabase/README.md) for the full local guide
(Studio UI, Inbucket OTP inbox, resets). Turnstile keys can wait — the
bot-check is skipped in local dev.

### 4. Set env vars
In Codespaces: copy `.env.example` to `.env.local` and fill in the **Option A
(local)** block with the keys from `npx supabase status`.
In Vercel (step 6): add the hosted keys instead (see below).

### 5. Run it
```bash
npm run dev
```
Open the forwarded port 3000 → sign up with a username + email → grab the OTP
code from Inbucket (port 54324) → create a tree.

### 6. Deploy to Vercel
Import the GitHub repo at vercel.com → add the env vars → Deploy. Every push
to `main` redeploys.

## Project layout

```
.devcontainer/        Codespaces container definition
app/
  page.tsx            Landing page
  login/              Passwordless login (username → captcha → OTP)
  signup/             Passwordless signup
  dashboard/          "My trees" + create-tree
  trees/[id]/         Tree detail: pedigree view, add-relative, invites, roster
  invite/[token]/     Accept an invite link
components/           TurnstileWidget, AddRelativeForm, TreeView, InvitePanel
lib/
  supabase/           Browser client, server client, admin (service-role) client
  auth.ts             requireUser / getProfile / getTreeRole helpers
  turnstile.ts        Server-side Turnstile verification
  types.ts            Shared TypeScript types
supabase/
  config.toml         Local CLI stack config (`npx supabase start`)
  migrations/         Baseline schema as a migration (auto-applied locally)
  schema.sql          Same schema for the hosted project (SQL Editor)
  README.md           Local-stack guide + going-live guide
middleware.ts         Supabase session refresh on every request
```

## Things Narendra must do himself (no code can do these)

1. **Create the GitHub repo** and push (or let Codespaces/Vercel guide you).
2. **Add the env vars** in Codespaces (`.env.local`, from `npx supabase status`)
   and Vercel.
3. **When going live**: create the hosted Supabase project + apply
   `supabase/schema.sql`, create a Cloudflare Turnstile site for the bot-check
   keys, and point Vercel at the hosted keys (all in `supabase/README.md`).
