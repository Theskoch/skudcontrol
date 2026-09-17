import { env } from "../../config/env.js";

export type UnifiClient = {
  id: string;
  type: string; // "WIRELESS" | "WIRED" | ...
  name: string;
  connectedAt: string;
  macAddress: string;
  uplinkDeviceId?: string;
};

type ClientsPage = { offset: number; limit: number; count: number; totalCount: number; data: UnifiClient[] };

function isConfigured(): boolean {
  return Boolean(env.unifiApiKey && env.unifiConsoleId && env.unifiSiteId);
}

/** Read-only: GET requests against the UniFi Integration API only, never an action/write endpoint. */
export async function fetchAllWifiClients(): Promise<UnifiClient[]> {
  if (!isConfigured()) return [];

  const base = `${env.unifiApiBaseUrl}/v1/connector/consoles/${env.unifiConsoleId}/proxy/network/integration/v1/sites/${env.unifiSiteId}/clients`;
  const all: UnifiClient[] = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const res = await fetch(`${base}?offset=${offset}&limit=${limit}`, {
      headers: { "X-API-Key": env.unifiApiKey!, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`UniFi API error ${res.status}: ${await res.text()}`);
    }
    const page = (await res.json()) as ClientsPage;
    all.push(...page.data);
    offset += page.data.length;
    if (page.data.length === 0 || offset >= page.totalCount) break;
  }

  return all.filter((c) => c.type === "WIRELESS");
}
