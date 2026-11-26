-- Preserve the former provider's history while removing their services from the marketplace.
UPDATE "ServiceListing" SET "isPublished" = false
WHERE "providerId" IN (SELECT id FROM "User" WHERE lower(email) = 'sbusisiwemawande@gmail.com' AND "isVerificationAdmin" = true);
UPDATE "Profile" SET role = 'admin'
WHERE "userId" IN (SELECT id FROM "User" WHERE lower(email) = 'sbusisiwemawande@gmail.com' AND "isVerificationAdmin" = true);
