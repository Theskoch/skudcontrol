-- AlterTable
ALTER TABLE "employees" ADD COLUMN "patronymic" TEXT;

-- CreateIndex
CREATE INDEX "employees_patronymic_idx" ON "employees"("patronymic");
