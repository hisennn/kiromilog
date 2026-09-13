# Kiromilog

Kiromilog is in English because I also use the project to study the language.

Kiromilog is a web app for tracking anime and manga. It was also made for a college activity about creating and presenting a new project.

## Features

- Account creation and login.
- Anime, manga, character, and user search.
- Anime and manga lists.
- Favorite anime, manga, and characters.
- Profile pages, follows, and messages.
- Profile avatar upload.
- Password recovery and account deletion.
- Adult content preference.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Neon Postgres and Neon Auth
- Drizzle ORM
- UploadThing
- Pusher
- Tenrai API (Jikan v4-compatible catalog, with Jikan as fallback)
- Iconoir icons

## Environment

Copy `.env.example` to `.env.local` and fill in the values.

Required:

```txt
DATABASE_URL=
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
NEXT_PUBLIC_APP_URL=
UPLOADTHING_TOKEN=
```

Optional:

```txt
PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
NEXT_PUBLIC_PUSHER_APP_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
```

In Neon Auth, add the production URL as a trusted origin:

```txt
https://kiromilog.vercel.app
```

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database

```bash
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

## Checks

```bash
npm run lint
npm test
npm run build
```

CI runs these checks and `npm audit` on pull requests and pushes to `main`,
and can also be started manually from GitHub Actions. Regression tests use
an in-memory PostgreSQL (PGlite), apply every migration, and simulate external
services; no production database or service credentials are used.

## Account deletion cleanup

Before deploying, apply the migrations with `npm run db:migrate` and set a
random `CRON_SECRET` in Vercel (for example, `openssl rand -hex 32`).
`vercel.json` schedules `/api/cron/account-deletions` daily at 06:00 UTC,
compatible with the Hobby plan. Vercel sends the secret in the Authorization
header; requests without it are rejected.

Deletion records a durable cleanup job before calling Neon Auth. Cleanup
only removes data after the identity no longer exists in `neon_auth."user"`.
If database or avatar cleanup fails, the daily job retries it, including when
the Auth response was lost. Active identities and unrelated orphan profiles
are not deleted. The routine processes up to 50 pending deletions per run.

## Notes

Avatars (up to 1 MB and 2048px per side) are stored in UploadThing. Neon stores only the avatar URL and file key.

Anime, manga, and character data comes from Tenrai (Jikan v4-compatible), falling back to Jikan.
