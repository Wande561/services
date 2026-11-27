ALTER TABLE "Profile"
  ADD COLUMN "clientEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "providerEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Profile"
SET "clientEnabled" = ("role" = 'client'::"AccountRole"),
    "providerEnabled" = ("role" = 'provider'::"AccountRole");
