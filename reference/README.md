# Legacy ICP migration

`legacy-icp-source.tar.gz` contains the Motoko source, configuration, and frontend files. `icp-backend-reference.tar.gz` contains the previous authentication and wallet integration. An import needs a separate export from the original canister or a verified backup.

## Prepare the export

1. Collect the original users, service listings, and historical bookings. Identify the exact source network and canister. Use the same source identifier on every run for that dataset.
2. Verify which existing ServiceConnect account owns each legacy principal. Complete onboarding for the target accounts and verify their roles. The profiles and credentials in ServiceConnect stay in place. Older code used the canister principal in some account paths, so set ambiguous records aside for review.
3. Normalize the export to the format below. Convert prices to integer rand cents and dates to UTC ISO timestamps. The importer accepts completed, cancelled, and declined bookings. Reconcile live bookings separately before cutover.

```json
{
  "version": 1,
  "source": "icp:local:uxrrr-q7777-77774-qaaaq-cai",
  "identities": [
    { "principal": "provider-example", "userId": "existing-provider-id", "role": "provider" },
    { "principal": "client-example", "userId": "existing-client-id", "role": "client" }
  ],
  "listings": [
    {
      "id": "service_1",
      "provider": "provider-example",
      "title": "House cleaning",
      "description": "Standard house cleaning",
      "category": "HouseCleaning",
      "location": "Cape Town",
      "priceCents": 15000,
      "maxPriceCents": null,
      "priceUnit": "PerHour",
      "createdAt": "2025-01-06T08:00:00Z"
    }
  ],
  "bookings": [
    {
      "id": "booking_1",
      "listing": "service_1",
      "client": "client-example",
      "provider": "provider-example",
      "serviceTitle": "House cleaning",
      "address": "Service address from the export",
      "notes": null,
      "startsAt": "2025-01-10T08:00:00Z",
      "endsAt": "2025-01-10T09:00:00Z",
      "status": "Completed",
      "createdAt": "2025-01-07T08:00:00Z"
    }
  ]
}
```

Keep exports containing addresses or personal data outside source control. Preserve any messages, reviews, ledger balances, and old payment records in the original archive for separate reconciliation. The legacy booking code initialized the amount to zero, so use independent receipt records to verify historical payments.

## Validate and import

Run from the repository root after applying the database migrations.

```sh
npm run legacy:import --prefix src/api -- /absolute/path/to/export.json
npm run legacy:import --prefix src/api -- /absolute/path/to/export.json --apply
```

Review the dry-run counts before using `--apply`. Applying writes approved mappings, draft listings, and booking history in a single transaction. Repeat imports report already imported records and preserve edits. Providers can review and publish their imported listings from **Manage listings**.
