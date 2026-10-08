# Team Hub

An internal resource and learning hub for COLDSiS. Staff can share, search and upvote useful resources (articles, tutorials, tools, templates, onboarding guides), and new interns get a guided onboarding path so they spend less time waiting and asking the same questions.

This is my final-year project. It is built to be used by a real team, and it also serves as the baseline for a small study on how people find shared knowledge. See [Research](#research).

**Live app:** https://team-hub-six-self.vercel.app
**API:** https://team-hub-server-e9yz.onrender.com (health check: `/api/health`)

> The API runs on a free tier that sleeps when idle. The first request after a quiet period can take about a minute.

## What it does

- **Resources:** add, edit and delete links with a title, description, category and tags
- **Search and filter:** full-text search with prefix matching (typing "onbo" finds "onboarding"), category and onboarding filters, and sorting
- **Upvotes:** one vote per person per resource
- **Onboarding path:** a checklist of essential resources, with each person's progress saved
- **Invite-only accounts:** admins create single-use, time-limited invite links, and people register through them

## Tech

| Part | Technology |
|---|---|
| Client | React, Vite, React Router |
| Server | Node.js, Express 5 |
| Database | PostgreSQL (hosted on Supabase) |
| Auth | JWT (bearer tokens), bcrypt password hashing |
| Hosting | Vercel (client), Render (server) |

## Repository layout

```
team-hub/
  client/    React app (Vite)
  server/    Express API
    src/
      routes/   auth, resources, onboarding, invites
    sql/        database setup scripts
```

## Run it locally

You need Node.js v22 and a PostgreSQL database. A free Supabase project works.

**1. Database**

Run the scripts in `server/sql/` in order, in the Supabase SQL editor.

**2. Server**

```bash
cd server
npm install
cp .env.example .env     # then fill in the values below
npm run dev
```

The API starts on the port specified by PORT, which defaults to 4000.

**3. Client**

```bash
cd client
npm install
npm run dev
```

The client runs on http://localhost:5174. Port 5174 is fixed on purpose, because the server only allows requests from the address in `CLIENT_ORIGIN`.

**4. First account**

Register with the email set as `ADMIN_EMAIL`. That one account can sign up without an invite and becomes an admin. Everyone else joins through an invite link created on the **Invite people** page.

## Environment variables

Never commit real values. Copy `server/.env.example` and `client/.env.example`.

**Server (`server/.env`)**

| Name | Purpose |
|---|---|
| `PORT` | Port the API listens on (the host sets this in production) |
| `CLIENT_ORIGIN` | The exact address of the client, e.g. `http://localhost:5174`. No trailing slash. |
| `DATABASE_URL` | PostgreSQL connection string |
| `PGSSL` | Whether to use SSL for the database connection |
| `JWT_SECRET` | Long random string used to sign login tokens. Use a different one in production. |
| `ADMIN_EMAIL` | The email allowed to register without an invite |

**Client (`client/.env`)**

| Name | Purpose |
|---|---|
| `VITE_API_URL` | Server base URL, without `/api` or a trailing slash. Leave unset locally. |

## Deployment

- **Server (Render):** root directory `server`, build command `npm install`, start command `npm start`, health check path `/api/health`, and the server environment variables above.
- **Client (Vercel):** root directory `client`, framework Vite, with `VITE_API_URL` set to the server address. `client/vercel.json` rewrites all paths to `index.html`, so refreshing on `/onboarding` or opening an invite link works.
- After the client is deployed, set the server's `CLIENT_ORIGIN` to the client's exact address, or the browser will block requests (CORS).

## Design decisions

- **Invite-only membership.** People join by invite, not open sign-up. Invite tokens are random, stored only as a hash, single-use, bound to one email and expire after 7 days.
- **Admins** are promoted manually in the database. There is no screen for it yet.
- **Login hardening.** Unknown emails take the same time as wrong passwords, with one generic error message. Login, registration and invite checks are rate-limited.
- **Plain search on purpose.** Search uses PostgreSQL full-text search without any ranking tricks, so it can serve as a baseline for later comparison.
- **Accessibility.** Real labels, error summaries that receive focus, live regions for status messages, a skip link, landmarks, managed focus on route changes and after actions, visible text alongside progress bars, and 44px touch targets.

## Known limitations

- No email verification yet. Invite links are shared by the admin directly.
- Admin promotion is manual SQL.
- The hosted API sleeps when idle (free tier).
- Search matches words and prefixes, not synonyms or meaning.

## Research

The hub also serves as the basis for a small study on how easily new interns can find the information they need. **The baseline evaluation has not been run yet.** The plan has two stages:

1. **Baseline.** Collect real questions from interns about their first weeks, decide in advance which resource answers each one, and test them against the current plain full-text search.
2. **Improvement.** Add one change aimed at the most common failure, then test the same questions again and compare.

Participation is voluntary. Participants will be told what is recorded (search text and onboarding progress) and asked for agreement before any data is collected. Results will be reported in the project write-up, not in this repository.

## Author

Eben Badger, final-year Computer Science. GitHub: [Badger-cmyk](https://github.com/Badger-cmyk)