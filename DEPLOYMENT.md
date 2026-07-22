# Deploying ServiceConnect (free tier)

This deploys the backend (Express + Socket.IO) to **Render**, the frontend (Vite/React)
to **Vercel**, and the database to **Neon** (managed Postgres, free forever, no card
required). All three have generous free tiers with no cost for a demo.

**Known limitation on this plan:** uploaded provider documents/photos are stored on
Render's local disk, which is wiped on every redeploy/restart on the free tier. Fine
for a demo; ask if you want this moved to persistent object storage (e.g. Cloudinary
free tier) later.

## 0. What you need to create (I can't do these for you)

1. A **GitHub** account + a new empty repository (e.g. `serviceconnect`).
2. A **Neon** account (neon.tech) — free, no credit card.
3. A **Render** account (render.com) — free, no credit card.
4. A **Vercel** account (vercel.com) — free, no credit card.

## 1. Database (Neon)

1. Sign up at neon.tech, create a new project (any region close to you).
2. Copy the connection string it gives you (starts with `postgresql://...`,
   make sure "Pooled connection" is OFF for the string you give me — Prisma
   migrations need the direct connection string).
3. Give me that connection string (or paste it into `backend/.env` yourself as
   `DATABASE_URL=...`) and I'll run the initial migration + seed against it.

## 2. Push the code to GitHub

```bash
git remote add origin https://github.com/<your-username>/serviceconnect.git
git branch -M main
git push -u origin main
```

(I can run this for you once the empty GitHub repo exists — just share the URL.)

## 3. Backend on Render

Render can read `render.yaml` at the repo root automatically ("Blueprint" deploy):

1. New → Blueprint → connect your GitHub repo → Render detects `render.yaml`.
2. It will ask you to fill in the two `sync: false` variables:
   - `DATABASE_URL` — the Neon connection string from step 1.
   - `CORS_ORIGIN` — leave blank for now, come back and set it after step 4
     (it needs your Vercel URL, e.g. `https://serviceconnect.vercel.app`).
3. Deploy. Render gives you a URL like `https://serviceconnect-api.onrender.com`.
   Note it — the frontend needs it.
4. **Free-tier note:** the service sleeps after 15 minutes of no traffic and takes
   ~30-60s to wake on the next request. Normal for free hosting, not a bug.

## 4. Frontend on Vercel

1. New Project → import the same GitHub repo.
2. Set **Root Directory** to `frontend` (Vercel auto-detects Vite; no other config needed).
3. Add an environment variable:
   - `VITE_API_URL` = `https://serviceconnect-api.onrender.com/api/v1`
     (your actual Render URL from step 3, with `/api/v1` appended).
4. Deploy. Vercel gives you a URL like `https://serviceconnect.vercel.app`.

## 5. Close the loop

Go back to the Render service → Environment → set `CORS_ORIGIN` to your Vercel URL
(e.g. `https://serviceconnect.vercel.app`, comma-separate if you have a preview URL
too) → save, which triggers a redeploy.

## 6. Seed the production database (once, after first deploy)

From your machine, with `backend/.env`'s `DATABASE_URL` pointed at the **same** Neon
database Render uses:

```bash
cd backend
npm run prisma:seed
```

This creates the service catalogue and the admin account
(`admin@serviceconnect.local` / `Admin!2026Strong` — **change this password** once
deployed, via the DB directly or by adding a password-change flow).

## Done

- Frontend: your Vercel URL
- Backend API: your Render URL
- Real-time (Socket.IO) works over the same Render URL automatically — no extra config.
