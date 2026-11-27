# DoIt API

The NestJS API supports accounts, sessions, onboarding, service listings, availability, bookings, messaging, notifications, and reviews.

Use Node.js 20 or newer and PostgreSQL. Install dependencies with `npm ci`, copy `.env.example` to `.env`, set `DATABASE_URL`, and run `npx prisma migrate deploy`. Start the service with `npm run start:dev` or build with `npm run build` and run `npm start`.

For Google sign-in, configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `FRONTEND_URL`. Register `FRONTEND_URL/api/auth/google/callback` as an authorized redirect URI in Google Cloud. The frontend rewrite forwards that path to the API. Set `GOOGLE_REDIRECT_URI` only if using a different callback URL; `API_URL` is not read by the API.

Password recovery uses Resend. Configure `RESEND_API_KEY` and a verified sender address in `MAIL_FROM`; reset links are sent to `FRONTEND_URL/reset-password` and expire after 30 minutes. Without these settings, reset requests still return a neutral response but no email is delivered.

The API exposes `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, and `GET /auth/google`. The register and login endpoints accept JSON and return the signed-in user with an HTTP-only session cookie. Requests that change state must include the configured frontend origin.

`PATCH /auth/profile` updates the signed-in user’s name, phone, location, and provider business name and categories. `POST /auth/password` verifies the current password, changes it, and signs out other sessions. Google-only accounts cannot change their password here. Both endpoints require the configured frontend origin.

`POST /auth/onboarding` saves the signed-in user's role and profile. It accepts `role` (`client` or `provider`), `name`, `phone`, and `location`. Providers also supply `businessName` and `serviceCategories`. The endpoint returns the updated account, and `GET /auth/me` includes its `profile` on future requests.

Password recovery uses `POST /auth/password-reset/request` with `email` and `POST /auth/password-reset/complete` with `token` and `newPassword`. Reset tokens are one-time, expire after 30 minutes, and signing in again is required after the password changes.

`GET /services` returns published listings with optional `search`, `category`, `location`, `page`, and `sort` filters. Sort values are `newest`, `price_asc`, `price_desc`, `rating` (most reviewed, then highest average rating), and `verified`. Providers use `GET /services/mine` to see their listings, `POST /services` to create a draft, `PUT /services/:id` to edit it, and `PATCH /services/:id/publication` with `isPublished` to publish or unpublish. Prices are stored as integer rand cents.

Clients use `GET /services/:id` and `GET /bookings/slots?service=:id` to select a published service and open slot. `POST /bookings` requires `listingId`, `slotId`, and `address`, with optional `notes`. Each participant can read their history with `GET /bookings` and update a booking through `PATCH /bookings/:id/status` when the transition is allowed.

Providers manage availability with `GET /bookings/availability`, `POST /bookings/availability`, and `PATCH /bookings/availability/:id/close`. New slots use `date` in `YYYY-MM-DD` and `startTime` and `endTime` in `HH:MM` SAST. A pending or confirmed booking reserves the slot across all of that provider’s listings.

Booking participants use `GET /messages` for their conversations, `GET /messages/:bookingId` for a thread, `POST /messages/:bookingId` with `body` to send a message, and `PATCH /messages/:bookingId/read` with `ids` to mark displayed messages read.

`GET /notifications` lists the signed-in user’s notifications. `GET /notifications/unread` returns separate unread message and notification counts. Use `PATCH /notifications/:id/read` or `PATCH /notifications/read-all` to mark alerts read.

`GET /notifications/preferences` and `PATCH /notifications/preferences` read and update in-app booking, message, review, payment, appointment, and expiring quote reminder choices. Confirmed bookings and active quotations receive an in-app reminder within 24 hours when the recipient has reminders enabled.

Clients and providers independently confirm service completion using `POST /bookings/:id/confirm-completion`; a confirmed booking becomes completed after both confirmations. Providers rate the client using `POST /reviews/:bookingId/client`. `GET /reviews/mine` returns the signed-in client or provider’s rating totals. Clients submit one review per completed booking with `POST /reviews/:bookingId`, an integer `rating` from 1 to 5, and an optional `comment`. `GET /reviews/services/:listingId` returns public reviews and rating totals for published services. `GET /reviews/mine` returns the signed-in user’s totals.

Providers record a payment they received directly with `POST /bookings/:id/payment`. The booking must be completed. Supply a positive integer `amountCents` and the method `Cash`, `BankTransfer`, or `CardInPerson`. The booking history exposes the payment to both participants. Providers use `PATCH /bookings/:id/payment/:paymentId/void` to preserve the original entry and enter a correction.

Quote requests use `GET /quotes`, `POST /quotes`, `GET /quotes/:id`, and authenticated `GET /quotes/:id/photos/:photoId`. Providers send offers using `POST /quotes/:id/offer`; clients respond with `POST /quotes/:id/response`. Quote alerts use `GET /quotes/alerts`, `PATCH /quotes/alerts/:id/read`, and `PATCH /quotes/alerts/read-all`. Providers can require a 25% deposit in `POST /quotes/:id/offer` and must provide bank name, account number, and reference with that offer. `POST /quotes/:id/confirm-deposit` records provider confirmation and creates a confirmed booking if the appointment remains available. `POST /quotes/:id/bank-details` is retained for older pending requests that have no bank details. Without a deposit, acceptance creates a booking immediately. Transfers happen outside the application and are not independently verified. Photos are private, limited to three JPEG, PNG or WebP images of at most 1 MB each.

Optional provider portfolios use `GET /portfolio/mine`, `POST /portfolio`, `PATCH /portfolio/:id`, and `DELETE /portfolio/:id`. `GET /portfolio/:providerId` and `GET /portfolio/images/:id` expose work for providers with published services. Images are limited to JPEG, PNG, or WebP and 1 MB each.

Clients and providers submit verification evidence via `POST /verification` and inspect their status using `GET /verification/mine`. Authorized verification administrators use `GET /verification/admin/submissions`, the document download endpoint and `POST /verification/admin/submissions/:id/decision`. Approval requires the reviewer to confirm each applicable check, and administrators cannot approve themselves. Client profile photos are optional; individual providers must include a photo. Phone and email ownership are checked manually; the application does not send verification codes.

Authenticated marketplace administrators can inspect `/admin/overview`, `/admin/accounts`, `/admin/bookings`, `/admin/quotes`, and `/admin/complaints`. Lists are paginated. They may update complaint status and suspend or restore non-administrator accounts with a reason; these actions are recorded. Clients and providers use `GET /complaints` and `POST /complaints` for their own reports.
