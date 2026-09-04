-- No payment gateway in this version — clients are turned on/off manually
-- by the admin from /admin once their bank transfer arrives.

-- DropTable
DROP TABLE "subscription";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "stripeCustomerId",
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'client',
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT false;
