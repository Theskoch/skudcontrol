-- CreateEnum
CREATE TYPE "NetworkSessionSource" AS ENUM ('UNIFI', 'MANUAL');

-- CreateTable
CREATE TABLE "network_sessions" (
    "id" TEXT NOT NULL,
    "mac_address" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "source" "NetworkSessionSource" NOT NULL DEFAULT 'UNIFI',
    "ap_label" TEXT,
    "rx_bytes" BIGINT,
    "tx_bytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "network_sessions_mac_address_started_at_idx" ON "network_sessions"("mac_address", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "network_sessions_mac_address_started_at_key" ON "network_sessions"("mac_address", "started_at");

