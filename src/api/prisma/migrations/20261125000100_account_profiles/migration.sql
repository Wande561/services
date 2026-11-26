-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('client', 'provider');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('Plumbing', 'HairStyling', 'HouseCleaning', 'Electrical', 'Gardening', 'PetGrooming', 'Tutoring', 'Construction', 'PersonalTraining');

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "businessName" TEXT,
    "serviceCategories" "ServiceCategory"[] DEFAULT ARRAY[]::"ServiceCategory"[],

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
