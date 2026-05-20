# Kiromilog

Kiromilog is a web app for tracking anime and manga.

The project was also made as part of a college activity. The goal is to present a new project with a clear scope, chosen technology, target use, and expected result.

## What It Does

- Create an account and sign in.
- Search anime, manga, characters, and users.
- Add anime and manga to personal lists.
- Mark anime, manga, and characters as favorites.
- View anime and manga details using data from Jikan.
- View character pages and cast pages.
- Follow users.
- Send messages when both users follow each other.
- Upload a profile avatar.
- Control adult content visibility in settings.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Neon Postgres
- Neon Auth
- Drizzle ORM
- UploadThing
- Pusher
- Jikan API
- Iconoir icons

## External Services

Kiromilog uses a few external services:

- Neon for the database and authentication.
- UploadThing for profile avatar uploads.
- Pusher for realtime messages and notifications.
- Jikan for anime, manga, and character data.

## Environment Variables

Create a `.env.local` file based on `.env.example`.

Required:

```txt
DATABASE_URL=
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
NEXT_PUBLIC_APP_URL=
UPLOADTHING_TOKEN=
```

Optional, used for realtime messages and notifications:

```txt
PUSHER_APP_ID=
PUSHER_APP_KEY=
PUSHER_APP_SECRET=
NEXT_PUBLIC_PUSHER_APP_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
```

For Vercel, add the same variables in the project environment settings.

For Neon Auth in production, add the deployed site URL as a trusted origin:

```txt
https://kiromilog.vercel.app
```

## Running Locally

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Database

Generate migrations:

```bash
npm run db:generate
```

Run migrations:

```bash
npm run db:migrate
```

Push schema directly:

```bash
npm run db:push
```

Open Drizzle Studio:

```bash
npm run db:studio
```

## Checks

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

## Notes

Profile avatars are uploaded to UploadThing. The database stores only the avatar URL and the UploadThing file key.

Anime, manga, and character information comes from Jikan, so availability depends on that API.

This project is still being developed and may change after the college presentation.
