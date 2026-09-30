import { describe, expect, it, vi } from "vitest";
import {
  OverpassDiscoveryProvider,
  describeHttpFailure,
  type FetchLike,
} from "@/lib/discovery/overpass-provider";
import { getProvider, listProviders } from "@/lib/discovery/registry";
import { DiscoveryError } from "@/lib/discovery/types";

/** Antwort-Attrappe im Format, das der Provider erwartet. */
function response(body: string, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

const GEOCODE_BODY = JSON.stringify([
  { lat: "50.938361", lon: "6.959974", display_name: "Köln, Nordrhein-Westfalen, Deutschland" },
]);

function overpassBody(elements: unknown[]): string {
  return JSON.stringify({ elements });
}

/** Baut einen Transport, der Geocoder und Overpass unterschiedlich beantwortet. */
function transport(handlers: {
  geocode?: () => ReturnType<typeof response>;
  overpass?: () => ReturnType<typeof response>;
}): { fetchImpl: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (input) => {
    calls.push(input);
    if (input.includes("nominatim")) {
      return handlers.geocode?.() ?? response(GEOCODE_BODY);
    }
    return handlers.overpass?.() ?? response(overpassBody([]));
  };
  return { fetchImpl, calls };
}

const QUERY = { city: "Köln", radiusKm: 10, industry: "elektriker", maxResults: 50 };

function makeProvider(fetchImpl: FetchLike) {
  return new OverpassDiscoveryProvider({
    fetchImpl,
    nominatimEndpoint: "https://nominatim.test/search",
    overpassEndpoint: "https://overpass.test/api/interpreter",
  });
}

describe("Provider-Registry", () => {
  it("liefert den Standard-Provider", () => {
    expect(getProvider().id).toBe("OSM_OVERPASS");
  });

  it("listet alle Provider mit Kennung und Quellenangabe", () => {
    const providers = listProviders();
    expect(providers.length).toBeGreaterThan(0);
    for (const provider of providers) {
      expect(provider.id).toBeTruthy();
      expect(provider.label).toBeTruthy();
      expect(provider.attribution).toBeTruthy();
    }
  });

  it("wirft bei unbekannter Quelle", () => {
    // @ts-expect-error – absichtlich ungültige Kennung
    expect(() => getProvider("GOOGLE_MAPS")).toThrow();
  });
});

describe("OverpassDiscoveryProvider.search", () => {
  it("liefert Ort, Mittelpunkt und abgebildete Treffer", async () => {
    const { fetchImpl, calls } = transport({
      overpass: () =>
        response(
          overpassBody([
            { type: "node", id: 1, lat: 50.9, lon: 6.9, tags: { name: "Elektro A", website: "a.de" } },
            { type: "node", id: 2, lat: 50.9, lon: 6.9, tags: { name: "Elektro B" } },
          ]),
        ),
    });

    const result = await makeProvider(fetchImpl).search(QUERY);

    expect(result.provider).toBe("OSM_OVERPASS");
    expect(result.resolvedPlace).toContain("Köln");
    expect(result.centerLat).toBeCloseTo(50.938361, 5);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]!.companyName).toBe("Elektro A");
    // Genau eine Geocoder- und eine Overpass-Anfrage pro Suche.
    expect(calls).toHaveLength(2);
  });

  it("begrenzt die Trefferzahl auf maxResults", async () => {
    const elements = Array.from({ length: 30 }, (_, index) => ({
      type: "node" as const,
      id: index + 1,
      lat: 50.9,
      lon: 6.9,
      tags: { name: `Firma ${index}` },
    }));
    const { fetchImpl } = transport({ overpass: () => response(overpassBody(elements)) });

    const result = await makeProvider(fetchImpl).search({ ...QUERY, maxResults: 5 });
    expect(result.candidates).toHaveLength(5);
  });

  it("meldet übersprungene Einträge ohne Namen als Hinweis", async () => {
    const { fetchImpl } = transport({
      overpass: () =>
        response(
          overpassBody([
            { type: "node", id: 1, tags: { name: "Mit Name" } },
            { type: "node", id: 2, tags: {} },
            { type: "node", id: 3 },
          ]),
        ),
    });

    const result = await makeProvider(fetchImpl).search(QUERY);
    expect(result.candidates).toHaveLength(1);
    expect(result.notices.join(" ")).toContain("ohne Firmennamen");
  });

  it("wirft bei unbekannter Branche, ohne eine Anfrage zu stellen", async () => {
    const { fetchImpl, calls } = transport({});
    await expect(
      makeProvider(fetchImpl).search({ ...QUERY, industry: "raumfahrt" }),
    ).rejects.toThrow(DiscoveryError);
    expect(calls).toHaveLength(0);
  });

  it("wirft, wenn der Ort nicht gefunden wird", async () => {
    const { fetchImpl } = transport({ geocode: () => response("[]") });
    await expect(makeProvider(fetchImpl).search(QUERY)).rejects.toThrow(
      /konnte nicht gefunden werden/,
    );
  });

  it("wirft bei unbrauchbaren Koordinaten", async () => {
    const { fetchImpl } = transport({
      geocode: () => response(JSON.stringify([{ lat: "keine", lon: "zahl" }])),
    });
    await expect(makeProvider(fetchImpl).search(QUERY)).rejects.toThrow(DiscoveryError);
  });

  it("meldet ein Rate Limit verständlich", async () => {
    const { fetchImpl } = transport({ overpass: () => response("", 429) });
    await expect(makeProvider(fetchImpl).search(QUERY)).rejects.toThrow(/Rate Limit/);
  });

  it("meldet ein Timeout der Quelle als Hinweis auf den Radius", async () => {
    const { fetchImpl } = transport({ overpass: () => response("", 504) });
    await expect(makeProvider(fetchImpl).search(QUERY)).rejects.toThrow(/Radius verkleinern/);
  });

  it("meldet defektes JSON als Fehler statt zu werfen", async () => {
    const { fetchImpl } = transport({ overpass: () => response("kein json") });
    await expect(makeProvider(fetchImpl).search(QUERY)).rejects.toThrow(DiscoveryError);
  });

  it("meldet eine Antwort ohne elements-Feld", async () => {
    const { fetchImpl } = transport({ overpass: () => response(JSON.stringify({ foo: 1 })) });
    await expect(makeProvider(fetchImpl).search(QUERY)).rejects.toThrow(DiscoveryError);
  });

  it("überspringt Einträge, die keine Overpass-Elemente sind", async () => {
    const { fetchImpl } = transport({
      overpass: () =>
        response(
          overpassBody([
            { type: "node", id: 1, tags: { name: "Gut" } },
            { type: "haus", id: 2, tags: { name: "Falscher Typ" } },
            "kaputt",
            null,
          ]),
        ),
    });
    const result = await makeProvider(fetchImpl).search(QUERY);
    expect(result.candidates.map((candidate) => candidate.companyName)).toEqual(["Gut"]);
  });

  it("verpackt Netzwerkfehler in eine verständliche Meldung", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("ECONNREFUSED");
    };
    await expect(makeProvider(fetchImpl).search(QUERY)).rejects.toThrow(/nicht erreichbar/);
  });

  it("bricht ab, wenn das Signal abgebrochen wird", async () => {
    const controller = new AbortController();
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });

    const promise = makeProvider(fetchImpl).search(QUERY, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow(DiscoveryError);
  });

  it("sendet einen aussagekräftigen User-Agent", async () => {
    const headers: Record<string, string>[] = [];
    const fetchImpl: FetchLike = async (input, init) => {
      headers.push(init?.headers ?? {});
      return input.includes("nominatim") ? response(GEOCODE_BODY) : response(overpassBody([]));
    };

    await makeProvider(fetchImpl).search(QUERY);
    for (const header of headers) {
      expect(header["user-agent"]).toContain("KundenRadar");
    }
  });

  it("stellt die Overpass-Abfrage per POST", async () => {
    const methods: (string | undefined)[] = [];
    const fetchImpl: FetchLike = async (input, init) => {
      methods.push(init?.method);
      return input.includes("nominatim") ? response(GEOCODE_BODY) : response(overpassBody([]));
    };

    await makeProvider(fetchImpl).search(QUERY);
    expect(methods).toEqual(["GET", "POST"]);
  });
});

describe("describeHttpFailure", () => {
  it("unterscheidet die wichtigen Fälle", () => {
    expect(describeHttpFailure(429)).toContain("Rate Limit");
    expect(describeHttpFailure(504)).toContain("Radius");
    expect(describeHttpFailure(500)).toContain("Serverfehler");
    expect(describeHttpFailure(400)).toContain("abgelehnt");
  });
});

describe("Zeitbudget", () => {
  it("bricht eine hängende Anfrage nach dem Timeout ab", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl: FetchLike = (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });

      const promise = makeProvider(fetchImpl).search(QUERY);
      const assertion = expect(promise).rejects.toThrow(/nicht rechtzeitig/);
      await vi.advanceTimersByTimeAsync(11_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
