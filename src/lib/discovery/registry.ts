import { OverpassDiscoveryProvider } from "./overpass-provider";
import type { DiscoveryProviderId, LeadDiscoveryProvider } from "./types";

/**
 * Registry der verfügbaren Datenquellen.
 *
 * Eine weitere Quelle wird hier eingehängt; Aufrufer arbeiten ausschliesslich
 * gegen `LeadDiscoveryProvider`.
 */
const PROVIDERS: Record<DiscoveryProviderId, () => LeadDiscoveryProvider> = {
  OSM_OVERPASS: () => new OverpassDiscoveryProvider(),
};

export const DEFAULT_PROVIDER_ID: DiscoveryProviderId = "OSM_OVERPASS";

export function getProvider(id: DiscoveryProviderId = DEFAULT_PROVIDER_ID): LeadDiscoveryProvider {
  const factory = PROVIDERS[id];
  if (!factory) throw new Error(`Unbekannte Datenquelle: ${id}`);
  return factory();
}

export function listProviders(): LeadDiscoveryProvider[] {
  return Object.values(PROVIDERS).map((factory) => factory());
}
