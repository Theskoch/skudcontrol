-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "is_blocked" BOOLEAN NOT NULL DEFAULT false;

