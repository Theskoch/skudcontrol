-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "sees_all" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "account_employee_access" (
    "account_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,

    CONSTRAINT "account_employee_access_pkey" PRIMARY KEY ("account_id","employee_id")
);

-- CreateIndex
CREATE INDEX "account_employee_access_employee_id_idx" ON "account_employee_access"("employee_id");

-- AddForeignKey
ALTER TABLE "account_employee_access" ADD CONSTRAINT "account_employee_access_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_employee_access" ADD CONSTRAINT "account_employee_access_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

