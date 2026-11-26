-- Recognise existing completed services without inventing historical penalties.
INSERT INTO "ReliabilityEntry" ("id", "userId", "bookingId", "kind", "pointsDelta", "creditsDelta", "createdAt")
SELECT 'complete_' || md5(events."bookingId" || ':' || events."userId"), events."userId", events."bookingId", 'Completed', 1, 0, events."completedAt"
FROM (
  SELECT b."id" AS "bookingId", b."clientId" AS "userId", COALESCE(GREATEST(b."clientCompletedAt", b."providerCompletedAt"), b."updatedAt") AS "completedAt"
  FROM "Booking" b JOIN "Profile" p ON p."userId" = b."clientId" AND p."role" = 'client'
  WHERE b."status" = 'Completed'
  UNION ALL
  SELECT b."id", s."providerId", COALESCE(GREATEST(b."clientCompletedAt", b."providerCompletedAt"), b."updatedAt")
  FROM "Booking" b JOIN "AvailabilitySlot" s ON s."id" = b."slotId" JOIN "Profile" p ON p."userId" = s."providerId" AND p."role" = 'provider'
  WHERE b."status" = 'Completed'
) AS events
ON CONFLICT ("bookingId", "userId", "kind") DO NOTHING;

INSERT INTO "ReliabilityAccount" ("userId", "points", "creditBalance", "updatedAt")
SELECT e."userId", SUM(e."pointsDelta")::INTEGER, 0, CURRENT_TIMESTAMP
FROM "ReliabilityEntry" e
GROUP BY e."userId"
ON CONFLICT ("userId") DO NOTHING;
