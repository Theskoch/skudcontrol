-- CreateTable
CREATE TABLE "network_traffic_samples" (
    "id" TEXT NOT NULL,
    "mac_address" TEXT NOT NULL,
    "sampled_at" TIMESTAMP(3) NOT NULL,
    "rx_bytes" BIGINT NOT NULL,
    "tx_bytes" BIGINT NOT NULL,

    CONSTRAINT "network_traffic_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "network_traffic_samples_mac_address_sampled_at_idx" ON "network_traffic_samples"("mac_address", "sampled_at");
