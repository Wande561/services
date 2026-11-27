# ServiceConnect

The application uses React and TypeScript for the frontend, with a NestJS API and PostgreSQL accessed through Prisma.

## Run locally

Install frontend dependencies with `pnpm install` at the repository root. Install API dependencies with `npm ci --prefix src/api`. Use Node.js 20 or newer and a running PostgreSQL database.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Vercel project settings, production environment variables, and safe migration/deployment order.

Copy `src/api/.env.example` to `src/api/.env` and set `DATABASE_URL`. Run `npm run db:migrate` from the repository root, then start the API with `npm run dev:api`. In a second terminal, start the frontend with `npm run dev` and open `http://localhost:3000`.

Email and password accounts are available. To enable Google sign-in, set the Google client ID and secret in `src/api/.env` and register `http://localhost:3000/api/auth/google/callback` as an authorized redirect URI. Adjust the frontend URL for other deployments.

After signing in, new and existing accounts without a profile can choose Client or Provider and complete their profile. Profiles are saved in PostgreSQL and users are sent to their dashboard. Each account has one role.

Providers can create, edit, publish, and unpublish listings from **Manage listings** on their dashboard. Visitors can search published services by keyword, category, and service area at `/services`. Providers can optionally add up to 20 work photos with example prices under **My work**; clients can open the portfolio from a published service.

Clients can request a quote from a published listing, including a preferred date and time, location, description, and up to three photos. Providers respond under **Quotes** with itemized fees, a proposed appointment, duration, notes, and an expiry period. Clients can accept, decline, or request changes; revised quotations retain earlier versions. Quote activity appears in in-app notifications. When preparing a quotation, a provider can require a 25% deposit and must provide bank details in the quote. After the client accepts and pays by immediate EFT, the provider confirms receipt; only then is a booking created, if the time remains available. Without a deposit, acceptance creates a confirmed booking if the time is available. The application does not process or independently verify transfers. Existing bookings remain available under **Bookings**. Times use South African Standard Time (SAST).

Each booking has a private message thread. Both dashboards show unread messages and notifications for booking updates, messages, and reviews. Clients and providers each confirm that the service was completed; the booking is marked complete only after both confirmations. Each can then rate the other once per booking. Providers can see a client’s average rating on their quote requests, and account settings show each user’s rating. Published listings show provider reviews.

Clients pay providers directly after service. Providers can record the amount and payment method on the completed booking. The provider dashboard distinguishes the full quoted value of completed services from payments recorded as received.

The [legacy ICP migration guide](reference/README.md) describes dry-run validation and importing approved account mappings, listings, and booking history.

## Provider verification

Clients and providers can request individual identity verification from Account settings; providers can also request registered business verification. A profile photograph is optional for clients and required for individual providers. Submissions remain pending until a verification administrator reviews the required evidence and independently checks the stated contact details. Clients see provider badges after approval, and providers see client badges on quote requests and bookings. Verification documents are stored in PostgreSQL and are accessible through authenticated administrator-only endpoints. Editing the verified account name, phone, or business name returns the account to Basic until it is reviewed again. Administrators cannot approve their own submissions. The app does not automatically verify phone or email ownership; reviewers must do that independently.

## Marketplace administration

Authorized administrators can open the admin centre to monitor marketplace counts and inspect paginated account, booking, quotation, and complaint lists. They can review identity and business verification submissions, update complaint status, and suspend or restore non-administrator accounts with an audit reason. Suspending an account revokes its sessions. Clients and providers can submit complaints from Complaints & support. The health panel reports whether the API and database are responding; it is not a full monitoring system.

## PostgreSQL

The NestJS API reads `DATABASE_URL` from `src/api/.env`. Prisma migrations create the tables for accounts, profiles, sessions, listings, availability, bookings, messages, notifications, reviews, payment records, and legacy account mappings. Run `npm run db:status` to check the connection and migration status.

This workspace’s local database is `doit` on `127.0.0.1:55432`. Its data directory is `src/api/.postgres/data`. Use the existing `src/api/.env` to keep connecting to this database. On another installation, create a project database and set `DATABASE_URL` to its connection string before running `npm run db:migrate`.

The app saves marketplace records as users work. A new database starts empty. Account settings support profile updates, password changes, and in-app notification preferences. Email and push notification delivery, privacy controls, and language and time zone settings are not yet available. Legacy ICP imports require a verified export.
