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
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Required for file uploads and reads in the private Cloudflare R2 bucket. Create credentials limited to this bucket with object read/write access. |
| `AI_PROVIDER` | Set explicitly to `openai` or `anthropic` for the server-side AI provider. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Required when `AI_PROVIDER=openai`. Store only in the API project's server environment. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Required when `AI_PROVIDER=anthropic`. Store only in the API project's server environment. |
| `AI_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_WINDOW_MS` | Per-user/per-endpoint request limit, default 10 requests per 60 seconds per API process. |
| `AI_MAX_OUTPUT_TOKENS`, `AI_REQUEST_TIMEOUT_MS`, `AI_CONVERSATION_HISTORY_TURNS` | AI response cap, upstream timeout, and retained turn count. Defaults are 600 tokens, 20 seconds, and 6 turns. |

The frontend uses relative `/api` requests, so it needs no API URL environment variable. Its rewrite target is currently `https://serviceconnect-api.vercel.app` in `src/doit_frontend/vercel.json`. If the API domain changes, update that target and the API project's `FRONTEND_URL` together.

AI requests and provider credentials stay on the API. Do not add AI credentials to Vite or any `VITE_*` variable. Before enabling the assistants in production, verify the selected provider's data-processing terms, data region, retention and billing controls, and complete the privacy review documented in `AI_SECURITY_REVIEW.md`. Current rate limits, usage logging, and conversations are process-local: they are not shared across API instances. Use one API instance for a controlled release or add a shared rate-limit/conversation store before scaling horizontally. Application logs record token usage when available, but daily/monthly cost reports and spend alerts must be configured in the provider account and production monitoring system.

## Safe production release order

1. Review the pending SQL migrations and verify, using the Vercel API project's Production environment settings, that `DATABASE_URL` names the intended production database. Take and verify a database backup using that database provider's backup process before applying migrations. Never paste the connection string into logs or chat.
2. Create a private R2 bucket and a bucket-scoped S3 API token with object read/write access. Add the four `R2_*` values to the API Vercel Production environment. Keep the bucket private; files are served through authenticated API routes.
3. From `src/api`, check migration status with `npx prisma migrate status` against the confirmed target. If the expected reviewed migrations are pending, apply them with `npx prisma migrate deploy`. Do not use `prisma migrate dev` against production.
4. Deploy the API project from the intended Git commit. Confirm its production build completes and inspect runtime logs for Prisma or R2 errors. The new API reads legacy database files while new uploads go to R2.
5. With the backup verified and the API serving traffic, run `npm run storage:migrate -- --apply` from `src/api` to copy legacy PostgreSQL files to R2 and clear their database byte columns. The command without `--apply` only reports the number of legacy files. Keep R2 credentials and `DATABASE_URL` configured for this operation. If interrupted, rerun the command; uploads use deterministic keys.
6. Deploy the frontend project from the same intended Git commit so its file upload flows match the API.
7. Smoke-check uploads and downloads for listing photos, quote photos, and verification documents. Also test notification preferences, password reset email, and Google sign-in if enabled. An unauthenticated `GET /notifications/preferences` returning `401` only confirms that the route is reachable; it does not validate authenticated database or object-storage access.

The latest object-storage migration adds nullable object keys while retaining legacy byte columns for a safe backfill. The backfill script uploads each legacy file to a deterministic R2 key before clearing its database bytes, so it can be rerun after interruption. Production migration status is intentionally not checked from this workspace because its local database URL is not evidence of the intended production target.
