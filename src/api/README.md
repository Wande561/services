# DoIt API

The NestJS API supports accounts, sessions, onboarding, service listings, availability, bookings, messaging, notifications, and reviews.

Use Node.js 20 or newer and PostgreSQL. Install dependencies with `npm ci`, copy `.env.example` to `.env`, set `DATABASE_URL`, and run `npx prisma migrate deploy`. Start the service with `npm run start:dev` or build with `npm run build` and run `npm start`.

For Google sign-in, configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `FRONTEND_URL`. Register `FRONTEND_URL/api/auth/google/callback` as an authorized redirect URI in Google Cloud. The frontend rewrite forwards that path to the API. Set `GOOGLE_REDIRECT_URI` only if using a different callback URL; `API_URL` is not read by the API.

Password recovery uses Resend. Configure `RESEND_API_KEY` and a verified sender address in `MAIL_FROM`; reset links are sent to `FRONTEND_URL/reset-password` and expire after 30 minutes. Without these settings, reset requests still return a neutral response but no email is delivered.

File uploads use a private Cloudflare R2 bucket through its S3-compatible API. Configure `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`. Local development without R2 credentials continues to store files in PostgreSQL; production file uploads fail with a service-unavailable response until R2 is configured. See the repository's `DEPLOYMENT.md` for the reviewed migration and legacy-file backfill order.

The API exposes `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, and `GET /auth/google`. The register and login endpoints accept JSON and return the signed-in user with an HTTP-only session cookie. Requests that change state must include the configured frontend origin.

## AI assistants

AI requests go from the React app to NestJS. The frontend never receives provider credentials or calls a provider. The AI module does not inject Prisma or access the database. Support answers use role-filtered, approved knowledge only; future user data must be retrieved through existing authorized backend services using the identity from the authenticated session.

### Support Assistant

`POST /api/ai/support/chat` (NestJS route `POST /ai/support/chat`) requires an authenticated client or provider session and the configured frontend origin. Send `{ "message": "...", "conversationId": "optional UUID" }`. Messages must contain 1–2,000 characters. The response is `{ "conversationId": "UUID", "answer": "..." }`. The server creates the conversation ID on the first request. User IDs and roles are not accepted in the body. The authenticated role is resolved server-side and selects which knowledge articles are supplied to the model.

Conversation history is held in API process memory for up to two hours after the last request and limited to six user/assistant turns. It is not written to PostgreSQL or application logs. A conversation ID is bound to both the authenticated user and their active role; another user or a switched role cannot use it. History is lost on API restart and is not shared across API instances, so users should start a new conversation if the server changes. The React dashboard exposes AI Support to clients and providers.

The verified support knowledge is organized by topic and role in `src/ai/support/support-knowledge.service.ts`. It covers accounts and settings, role-specific verification, finding or managing services, client and provider quote steps, bookings and cancellations, messages, direct payments, and Complaints & Support. To update it, first verify the wording against the current API implementation and frontend behavior, then edit the relevant role-scoped article and its retrieval keywords. Unsupported questions receive a fallback without calling the AI provider. The prompt and safety rules are in `src/ai/support/support.prompt.ts`.

The shared provider client is implemented in `src/ai/providers/ai-provider.client.ts`. It supports OpenAI and Anthropic using server-side `AI_PROVIDER`, the matching API key, and model setting. Configuration is checked only when an answer needs a provider call, so missing keys do not prevent unrelated API functionality from starting. Provider errors, timeouts, and incomplete configuration return a friendly retry message; upstream error bodies and credentials are not exposed. The client has no tools or database connection and cannot perform account, booking, quote, or payment actions.

### Provider Assistant

`POST /api/ai/provider` (NestJS route `POST /ai/provider`) requires an authenticated provider session and the configured frontend origin. It accepts the same message and optional conversation ID shape as AI Support and returns `{ "conversationId": "UUID", "answer": "..." }`. The provider identity comes only from the authenticated session; request bodies cannot supply provider IDs or roles. The route uses the existing AI session, role, rate-limit, provider-client, usage-monitor, token, and timeout protections.

The assistant supports daily and weekly workload summaries, provider booking requests and appointments, quote request and expiry summaries, notification summaries, and reviewable quote/message drafts. It does not accept, reject, cancel, reschedule, submit, change notification state, or send client messages. Generated drafts are text for the provider to review and use through the existing Quotes or Messages screens. The prompt explicitly prevents final price suggestions and treats retrieved record text as untrusted content.

`src/ai/provider/provider-data.service.ts` chooses the needed data category from the provider's question. It does not access Prisma. It calls read-only assistant methods added to the existing `BookingsService`, `QuotesService`, `NotificationsService`, `MessagesService`, and `ProvidersService`. Each method scopes reads to the authenticated provider ID in its database query. Message context is loaded only for draft requests and only after the existing message service verifies quote or booking ownership. Client names, addresses, bank details, and quote amounts are not included; client text is length-limited and email/phone patterns are removed before it reaches the model. Notification reads do not create preferences or mark records as read.

Booking status counts use the stored `Pending`, `Confirmed`, `Declined`, `Cancelled`, and `Completed` values. Quote status counts use the stored `Pending`, `Quoted`, `Accepted`, `Declined`, `RevisionRequested`, `DepositPending`, and `SlotUnavailable` values. A quote is considered expired only from its latest version's `expiresAt` timestamp; no `Expired` database status is invented. Appointment windows use Africa/Johannesburg (SAST, UTC+02:00), and results sent to the model are capped to recent relevant records.

Provider Assistant conversations are held in a separate API-memory store from AI Support, are bound to one provider ID, expire after two hours idle, and retain at most six user/assistant turns. As with support conversations and rate limits, this in-memory state is not shared across API instances. No database migration or new provider credential is required.

`AI_RATE_LIMIT_MAX` and `AI_RATE_LIMIT_WINDOW_MS` set the default per-user/per-endpoint limit (10 requests per 60,000 ms). `AI_MAX_OUTPUT_TOKENS`, `AI_REQUEST_TIMEOUT_MS`, and `AI_CONVERSATION_HISTORY_TURNS` control response length, request timeout, and context size. `AiUsageMonitor` records user ID, endpoint, timestamp, provider, outcome, and token usage when returned; it does not accept or log conversation text. The rate limiter and conversations are in memory, so deployments with multiple API instances should move these to shared storage before production use.

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
