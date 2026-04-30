# Revinime

Anime and manga tracking app built with Next.js App Router, Neon Auth, Drizzle, and Jikan-backed media data.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run db:generate
npm run db:migrate
npm run db:push
```

## Environment

Create `.env.local` with the values required by the integrations referenced in `src/lib/env.ts`.

## Stack

- `next@16`
- `react@19`
- `drizzle-orm`
- `@neondatabase/auth`
- `@neondatabase/serverless`
- `zod`
