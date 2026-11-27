# Deployment guide

ServiceConnect has two Vercel projects connected to this repository. Deploy the API and frontend separately. The project root directory is a Vercel dashboard setting, so keep these values in sync with the linked projects:

| Vercel project | Root directory | Framework/build settings |
| --- | --- | --- |
| `serviceconnect-api` | `src/api` | NestJS; Node.js 20 or newer. The entrypoint is `src/main.ts`; `npm run build` generates Prisma Client and compiles TypeScript. Let Vercel use its NestJS function output. |
| `serviceconnect-web` | `src/doit_frontend` | Vite; build command `npm run build`; output directory `dist`. `vercel.json` contains these settings and the `/api/*` rewrite. |

The API entrypoint follows Vercel's NestJS entrypoint convention, so no custom API `vercel.json` or output directory is needed. Keep each project's root directory set as shown; a repository `vercel.json` cannot set that project-level value.

## API environment variables

Set these in the API Vercel project's Production environment. Use Preview values separately if preview deployments should use a non-production database and services.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Connection string for the intended PostgreSQL database. |
| `FRONTEND_URL` | Exact frontend origin, for example `https://serviceconnect-web-ten.vercel.app`; used for CORS, redirects, and reset links. |
| `NODE_ENV` | Set to `production` so session cookies are secure. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Required for Google sign-in. |
| `GOOGLE_REDIRECT_URI` | Optional override. By default, the callback is `${FRONTEND_URL}/api/auth/google/callback`, which the frontend rewrite forwards to the API. Register that exact URI in Google Cloud. |
| `RESEND_API_KEY`, `MAIL_FROM` | Required for password reset email. `MAIL_FROM` must be a sender verified with Resend. |

The frontend uses relative `/api` requests, so it needs no API URL environment variable. Its rewrite target is currently `https://serviceconnect-api.vercel.app` in `src/doit_frontend/vercel.json`. If the API domain changes, update that target and the API project's `FRONTEND_URL` together.

## Safe production release order

1. Review the pending SQL migrations and verify, using the Vercel API project's Production environment settings, that `DATABASE_URL` names the intended production database. Take and verify a database backup using that database provider's backup process before applying migrations. Never paste the connection string into logs or chat.
2. From `src/api`, check migration status with `npx prisma migrate status` against the confirmed target. If the expected reviewed migrations are pending, apply them with `npx prisma migrate deploy`. Do not use `prisma migrate dev` against production.
3. Deploy the API project from the intended Git commit. Confirm its production build completes and inspect runtime logs for Prisma connection or schema errors.
4. Deploy the frontend project from the same intended Git commit so its password recovery and notification preference screens match the API.
5. Smoke-check the production site: sign in, load and save notification preferences, submit a password reset request and confirm email delivery, complete the reset flow, and check Google sign-in if enabled. An unauthenticated `GET /notifications/preferences` returning `401` only confirms that the route is reachable; it does not validate authenticated database access.

The latest migration adds password-reset and notification-preference tables and notification deduplication fields. Production migration status is intentionally not checked from this workspace because its local database URL is not evidence of the intended production target.
