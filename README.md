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
- Jikan API
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
npm run build
```

## Notes

Avatars are stored in UploadThing. Neon stores only the avatar URL and file key.

Anime, manga, and character data comes from Jikan.
