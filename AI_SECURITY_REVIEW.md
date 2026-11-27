# Service Connect AI security review

Review date: 2026-11-27  
Scope: NestJS AI infrastructure, Support Assistant, Provider Assistant, React chat interface, related provider-scoped read methods, tests, and deployment configuration.  
Release status: **Not approved for production deployment. No deployment was performed.**

This review is based on the checked-out code and automated tests in this workspace. It is not a penetration test, a review of the production environment, or legal advice.

## Results

| Severity | Finding | Status |
| --- | --- | --- |
| Critical | No confirmed critical vulnerability was found in the inspected AI paths. | No issue observed; does not establish absence of vulnerabilities. |
| High | POPIA processor terms, cross-border processing, retention, and user transparency have not been verified for the selected AI provider and account. | Release blocker for privacy approval. |
| High | Rate limits and chat histories are held in each API process. Multiple instances do not share these controls or conversations. | Release blocker unless production is single-instance or a shared store is implemented. |
| Medium | API TypeScript production build fails in object-storage-related service code because the checked-out generated Prisma Client is stale and does not match `prisma/schema.prisma`. | Release blocker; regeneration in this workspace did not refresh the client. |
| Medium | Business Insights SQL has not been run against PostgreSQL. The configured local PostgreSQL cluster is stopped and cannot be started under the workspace permissions. | Release blocker for metric-data validation; run the read-only integration check against an isolated test database. |
| Medium | Usage events contain user ID, route, provider, success, timestamp, and token count in application logs. There is no durable daily/monthly report, cost calculation, or spending alert in the application. | Configure protected log aggregation and provider billing alerts before release. |
| Medium | Provider questions and selected provider records are sent to the configured external AI provider. Pattern-based scrubbing removes common emails, phone numbers, and currency values, but cannot reliably identify all personal information in free text. | Minimize submitted data and complete privacy/provider review before release. |
| Low | No frontend component-test or end-to-end harness is configured for assistant visibility, keyboard behavior, mobile layout, or network states. | Frontend build and static behavior review completed; add browser tests when the project has a UI test harness. |
| Informational | Conversations are kept in process memory for up to two idle hours, capped to six turns and a maximum of 5,000 conversations per assistant process. They disappear on restart and cannot be deleted independently by a user. | Documented behavior; decide retention and deletion requirements before persistent chat is introduced. |

## Authentication, authorization, and isolation

- AI routes require the HTTP-only session cookie. The session guard resolves the account through `AuthService.currentUser`, which checks session expiry and suspended accounts; client-supplied IDs and roles are rejected by request validation.
- `POST /ai/support/chat` allows authenticated client and provider roles. `POST /ai/provider` allows provider role only. Both require the configured frontend origin and send `Cache-Control: private, no-store`.
- Support conversation IDs are bound to user ID and role. Provider conversation IDs are bound to provider user ID. Separate service stores prevent an ID from crossing assistant types. Unknown IDs expire into a `404`; another owner receives `403`.
- The provider orchestration layer does not access Prisma. It calls existing read-only services. Booking, quote, quote-alert, notification, message-thread, and provider-profile reads include the authenticated provider identity in their database ownership filters. Quote and booking message context verifies ownership before reading messages.
- Provider context is bounded to recent records and at most three client threads with three messages each. Personal names, contact fields, addresses, banking fields, and final quote amounts are not selected for AI context. Free-text email, phone, and common currency patterns are scrubbed. The assistant now loads provider location and working hours only for an explicit profile question, not quote or draft work.
- Business Insights metrics are aggregated in PostgreSQL and filtered by the authenticated provider ID in each query. Only those aggregate metrics and deterministic recommendations are sent for AI observations; service labels are shown in the dashboard and are not supplied as customer data. Quote acceptance excludes pending and awaiting-response records; its denominator is accepted outcomes, declined requests with at least one submitted version, and latest-version expiries in the selected period. Expiry is not treated as rejection. Response time and profitability are not reported because the schema does not provide reliable event/cost data.
- No AI service receives database credentials, SQL access, or action tools. Marketplace mutations remain on their existing authenticated endpoints.

## Prompt injection and action limits

- Both system prompts label conversation and retrieved text as untrusted and prohibit revealing instructions or taking marketplace actions.
- Backend authorization and read-only data services enforce the actual access boundary; prompt wording is not used as authorization.
- Existing tests check that malicious text is passed only as user/untrusted content, that no tools are supplied, that provider IDs remain server-derived, and that provider-owned query filters are used.
- A deterministic unit test cannot prove how a live language model will respond to every injection. Continue provider-specific red-team testing before exposing the feature to real customer data.
- The UI renders assistant text as React text nodes (`<p>{item.text}</p>`), not HTML. No Markdown or unsafe HTML renderer is used.

## Functional and reliability checks

- Support knowledge is role-filtered and based on the current application workflow. Unsupported questions receive a verified-information fallback without a model call.
- Provider capabilities cover summaries, booking and appointment queries, quote attention/expiry, notifications, profile information, and drafts. Counts and statuses come from backend queries; quote expiry is derived from the latest quote version timestamp.
- Provider drafts are advisory. The UI labels them as drafts and links to existing Quotes or Messages pages; sending or submission remains a manual dashboard action.
- Both assistants enforce 2,000-character messages, bounded conversation history, output token caps, provider request timeouts, and per-user/per-endpoint process-local rate limits. Duplicate sends are prevented in the component while a request is in flight.
- Production API startup now rejects a missing, non-HTTPS, or non-origin `FRONTEND_URL`; this also keeps CORS and frontend-origin checks aligned.
- Provider failures and incomplete AI configuration return generic user-facing errors. Upstream response bodies, API keys, prompts, and conversation text are not logged by the AI usage monitor.
- Errors in AI data retrieval are caught by the assistant service and do not trigger a marketplace mutation.

## Data sent to the configured AI provider

Support calls send the user's question, bounded recent conversation turns, and a small selection of role-appropriate approved help articles. Provider calls send the user's question, bounded conversation turns, and only the record categories chosen for the question. Provider record text can include client-supplied request descriptions, notes, and recent messages after length limits and pattern-based scrubbing. The provider request uses OpenAI Responses API with `store: false` or Anthropic Messages API, depending on server configuration. No AI provider key is present in the React app.

The code does not establish the provider account's data-retention terms, region, subprocessors, training settings beyond the OpenAI request's `store: false`, or a lawful cross-border transfer basis. A responsible privacy/legal reviewer must check the actual provider agreement and settings, update the Service Connect privacy notice, identify the purpose and lawful basis, assess operator terms and safeguards, and define retention and data-subject request handling before production data is sent.

## Usage and cost monitoring

`AiUsageMonitor` records structured operational metadata and token usage when returned by the upstream provider. It does not persist a usage ledger and the application has no daily/monthly reporting, currency-cost calculation, or configurable spending threshold. Configure access-controlled log retention and alerts in the production monitoring platform, and billing/spend limits in the AI provider account. Do not expose user-level usage records or internal cost data to ordinary accounts.

## Automated checks

On 2026-11-27:

- `node test/ai-infrastructure.test.cjs`, `node test/provider-assistant.test.cjs`, and `node test/support-assistant.test.cjs`: passed after the audit changes (45 tests across the three suites).
- `node --test test/*.test.cjs`: all 9 test files passed after updating the listing-description test double for the object-storage update path.
- `npm run build` in `src/doit_frontend`: passed. Vite reported stale browser data and a large JavaScript bundle warning.
- `npm run build` in `src/api`: failed with Prisma type errors in `quotes.service.ts`, `services.service.ts`, and `verification.service.ts` because the generated client under `node_modules/.prisma/client` is older than the checked-out schema. `prisma generate` exited successfully but did not refresh that client. No TypeScript errors were reported under `src/ai`; the standard `npm test` command remains blocked by its build step.
- Business Insights tests assert provider predicates and metric definitions with mocked Prisma raw queries. A live SQL integration check could not be run: the configured local PostgreSQL cluster is stopped, and the workspace cannot start it. No production database, provider account, multi-account integration environment, or browser automation test environment was used.

## Deployment requirements

Before a controlled production release:

1. Resolve Prisma Client generation/type errors, then run `npm run build` and `npm test` from a clean install.
2. Choose a single-instance deployment or move rate-limit buckets and conversation state to a shared, user/role-scoped store with explicit retention and deletion behavior.
3. Configure `NODE_ENV=production`, an HTTPS `FRONTEND_URL`, secure server-side `AI_PROVIDER` / matching provider key / model, and secret-manager storage. Never set provider credentials in frontend build variables.
4. Confirm HTTPS termination, exact CORS origin, log redaction/access control/retention, provider billing alerts, and external monitoring.
5. Complete provider contract and POPIA review, update user-facing privacy disclosures, and approve the categories of free-text data sent to the provider.
6. Run separate-account integration tests for client A, client B, provider A, and provider B against isolated test data, plus browser checks at desktop and mobile widths.
7. Review database migration status and backup procedure against the intended production database. No AI-specific database migration was added.
8. Against isolated test providers in PostgreSQL, validate the Business Insights period boundaries, status counts, latest quote-version expiry logic, acceptance denominator, and cross-provider isolation; smoke-check AI observations using aggregate data only.

No dependency was added for the AI security work in this review. The workspace already contains unrelated uncommitted object-storage and marketplace changes; this review did not deploy, merge, or revert them.
