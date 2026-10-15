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

export type UnifiTrafficCounter = { macAddress: string; rxBytes: number; txBytes: number };

/**
 * Read-only: the Integration API's client list has no byte counters, so these
 * come from the controller's classic `stat/sta` endpoint (same proxy, same
 * key, GET only). Counters are cumulative since the client last associated.
 */
export async function fetchWifiTrafficCounters(): Promise<UnifiTrafficCounter[]> {
  if (!isConfigured()) return [];

  const url = `${env.unifiApiBaseUrl}/v1/connector/consoles/${env.unifiConsoleId}/proxy/network/api/s/default/stat/sta`;
  const res = await fetch(url, { headers: { "X-API-Key": env.unifiApiKey!, Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`UniFi stat/sta error ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as {
    data?: { mac?: string; is_wired?: boolean; rx_bytes?: number; tx_bytes?: number }[];
  };

  return (body.data ?? [])
    .filter((c) => !c.is_wired && c.mac && c.rx_bytes != null && c.tx_bytes != null)
    .map((c) => ({ macAddress: c.mac!, rxBytes: c.rx_bytes!, txBytes: c.tx_bytes! }));
}
