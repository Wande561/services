# Quote and booking implementation plan

1. Add independent quote requests, photo attachments, immutable quotation versions, appointment and deposit state, and quote-related notifications in an additive migration. Preserve existing accounts, listings, bookings and payment records.
2. Add authenticated APIs for requests, secure photo access, offers, revision requests and responses. Calculate prices and expiry on the server. Keep a complete history.
3. Accept an offer in a transaction. Serialize all confirmation attempts per provider, check overlap against confirmed appointments using the proposed duration, and atomically confirm a no-deposit booking or create an unreserved pending-deposit booking. Deposit confirmation uses the same lock and availability check and marks overlapping pending bookings unavailable, with notifications.
4. Add persistent in-app notifications and a deduplicated scheduled expiration and reminder process. Never send a pending-deposit reminder once the booking leaves that state.
5. Replace the direct booking UI with quote requests and add client/provider quote management, version review, deposit confirmation and booking displays. Preserve unrelated existing flows.
6. Test access control, expiry, revisions, notification routing, money rounding, concurrency, competing appointments and the full client/provider journeys against a disposable PostgreSQL database before applying migrations to existing data.
