import crypto from "crypto";

const PREFIX = "skud_live_";

export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const secret = crypto.randomBytes(24).toString("hex");
  const plaintext = `${PREFIX}${secret}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, PREFIX.length + 6),
  };
}

/** High-entropy random secrets don't need a per-key salt the way user passwords do. */
export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}
