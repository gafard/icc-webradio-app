This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## SQLite Runtime Notes

- SQLite databases are embedded in `data/`:
  - `data/strong.sqlite`
  - `data/treasury.sqlite`
  - `data/matthew_henry.sqlite`
  - `data/nave.sqlite`
- `next.config.ts` includes these files in server traces for API routes via `outputFileTracingIncludes`.
- Runtime check endpoint:
  - `GET /api/sqlite/health`
  - Returns `200` when `sqlite3` CLI and all SQLite files are available at runtime.
  - Returns `503` with diagnostics when something is missing.
- Note:
  - If `STRONG_DB_PATH`, `TREASURY_DB_PATH`, `MATTHEW_HENRY_DB_PATH`, `NAVE_DB_PATH` are set, APIs will use those explicit paths first.
  - For fully embedded mode, unset these env vars and rely on `data/*.sqlite`.
