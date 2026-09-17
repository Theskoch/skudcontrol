-- AlterEnum
ALTER TYPE "EventSource" ADD VALUE 'IMPORTED';

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "deletion_marked_at" TIMESTAMP(3),
ALTER COLUMN "serialNumber" DROP NOT NULL,
ALTER COLUMN "macAddress" DROP NOT NULL;

