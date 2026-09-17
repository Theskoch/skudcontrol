function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  appTz: required("APP_TZ", "Europe/Moscow"),
  port: Number(required("PORT", "4000")),
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME ?? "admin",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "admin",
  // Directory watched for the client's hourly ACS export; falls back to the
  // bundled Report/ folder next to the project when unset (e.g. local dev).
  reportDir: process.env.REPORT_DIR,
  // Shared secret for the machine-to-machine Wi-Fi session ingestion endpoint
  // (a future UniFi/MikroTik poller), separate from cookie-based admin auth.
  networkIngestToken: process.env.NETWORK_INGEST_TOKEN,
  // UniFi Site Manager API (https://api.ui.com) - read-only (GET only, no
  // actions/writes against the controller).
  unifiApiKey: process.env.UNIFI_API_KEY,
  unifiApiBaseUrl: process.env.UNIFI_API_BASE_URL ?? "https://api.ui.com",
  unifiSiteId: process.env.UNIFI_SITE_ID,
  unifiConsoleId: process.env.UNIFI_CONSOLE_ID,
  // Comma-separated list of allowed CORS origins for production (e.g. the
  // public HTTPS domain behind the reverse proxy). Unset = allow any origin,
  // which is fine for local dev where frontend/backend run on different ports.
  corsOrigins: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
    : null,
  // Whether the auth cookie gets the Secure flag - true once served over
  // HTTPS via the reverse proxy, false for local http://localhost testing.
  cookieSecure: process.env.COOKIE_SECURE === "true",
};
