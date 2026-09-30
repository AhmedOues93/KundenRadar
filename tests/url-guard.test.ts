import { describe, expect, it } from "vitest";
import {
  BlockedUrlError,
  assertPublicUrl,
  isBlockedHostname,
  isBlockedIPv4,
  isBlockedIPv6,
  isBlockedIp,
  normalizeUrl,
} from "@/lib/analysis/url-guard";

describe("normalizeUrl", () => {
  it("ergänzt ein fehlendes Schema", () => {
    expect(normalizeUrl("example.com").toString()).toBe("https://example.com/");
  });

  it("entfernt den Fragment-Teil", () => {
    expect(normalizeUrl("https://example.com/a#b").toString()).toBe("https://example.com/a");
  });

  it("lehnt andere Protokolle ab", () => {
    for (const input of ["file:///etc/passwd", "ftp://example.com", "gopher://example.com"]) {
      expect(() => normalizeUrl(input)).toThrow(BlockedUrlError);
    }
  });

  it("lehnt eingebettete Zugangsdaten ab", () => {
    expect(() => normalizeUrl("https://user:pass@example.com")).toThrow(BlockedUrlError);
  });

  it("lehnt nicht freigegebene Ports ab", () => {
    expect(() => normalizeUrl("http://example.com:22")).toThrow(BlockedUrlError);
    expect(() => normalizeUrl("http://example.com:6379")).toThrow(BlockedUrlError);
    expect(normalizeUrl("http://example.com:8080").port).toBe("8080");
  });

  it("lehnt leere und überlange Eingaben ab", () => {
    expect(() => normalizeUrl("   ")).toThrow(BlockedUrlError);
    expect(() => normalizeUrl(`https://example.com/${"a".repeat(2100)}`)).toThrow(BlockedUrlError);
  });
});

describe("isBlockedHostname", () => {
  it("blockiert localhost und interne Namen", () => {
    for (const host of [
      "localhost",
      "LOCALHOST",
      "localhost.",
      "app.localhost",
      "server.local",
      "db.internal",
      "api.intranet",
      "host.lan",
      "metadata.google.internal",
      "instance-data",
      "kubernetes.default.svc",
      "service.cluster.local",
      "redis",
      "buildserver",
    ]) {
      expect(isBlockedHostname(host), host).toBe(true);
    }
  });

  it("lässt normale öffentliche Hostnamen zu", () => {
    for (const host of ["example.com", "www.example.co.uk", "sub.domain.de", "1.2.3.4"]) {
      expect(isBlockedHostname(host), host).toBe(false);
    }
  });
});

describe("isBlockedIPv4", () => {
  it("blockiert loopback, private und reservierte Bereiche", () => {
    for (const ip of [
      "127.0.0.1",
      "127.1.2.3",
      "0.0.0.0",
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // Cloud-Metadata
      "169.254.170.2", // ECS Task Metadata
      "100.64.0.1",
      "192.0.0.1",
      "192.0.2.5",
      "198.18.0.1",
      "198.51.100.7",
      "203.0.113.9",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isBlockedIPv4(ip), ip).toBe(true);
    }
  });

  it("lässt öffentliche Adressen zu", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "11.0.0.1"]) {
      expect(isBlockedIPv4(ip), ip).toBe(false);
    }
  });

  it("behandelt ungültige Eingaben als blockiert", () => {
    for (const ip of ["", "abc", "1.2.3", "256.1.1.1", "1.2.3.4.5"]) {
      expect(isBlockedIPv4(ip), ip).toBe(true);
    }
  });
});

describe("isBlockedIPv6", () => {
  it("blockiert loopback, unique-local, link-local und multicast", () => {
    for (const ip of [
      "::1",
      "::",
      "[::1]",
      "fc00::1",
      "fd12:3456:789a::1",
      "fe80::1",
      "fe80::abcd%eth0",
      "ff02::1",
      "100::1",
      "2001:db8::1",
      "64:ff9b::7f00:1",
      "2002:7f00:1::1",
    ]) {
      expect(isBlockedIPv6(ip), ip).toBe(true);
    }
  });

  it("blockiert IPv4-mapped Adressen in internen Bereichen", () => {
    for (const ip of ["::ffff:127.0.0.1", "::ffff:169.254.169.254", "::ffff:10.0.0.1"]) {
      expect(isBlockedIPv6(ip), ip).toBe(true);
    }
  });

  it("lässt öffentliche IPv6-Adressen zu", () => {
    for (const ip of ["2606:4700:4700::1111", "2a00:1450:4001:80e::200e", "::ffff:8.8.8.8"]) {
      expect(isBlockedIPv6(ip), ip).toBe(false);
    }
  });
});

describe("isBlockedIp", () => {
  it("erkennt die IP-Version selbst", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("kein-ip")).toBe(true);
  });
});

describe("assertPublicUrl", () => {
  const publicResolver = async () => ["93.184.216.34"];
  const privateResolver = async () => ["10.0.0.5"];
  const mixedResolver = async () => ["93.184.216.34", "127.0.0.1"];

  it("lässt öffentliche Ziele durch", async () => {
    const result = await assertPublicUrl("https://example.com/pfad", {
      resolver: publicResolver,
    });
    expect(result.hostname).toBe("example.com");
    expect(result.addresses).toEqual(["93.184.216.34"]);
  });

  it("blockiert DNS-Antworten aus privaten Netzen (DNS-Rebinding)", async () => {
    await expect(
      assertPublicUrl("https://evil.example", { resolver: privateResolver }),
    ).rejects.toThrow(BlockedUrlError);
  });

  it("blockiert, sobald eine von mehreren Adressen intern ist", async () => {
    await expect(
      assertPublicUrl("https://evil.example", { resolver: mixedResolver }),
    ).rejects.toThrow(BlockedUrlError);
  });

  it("blockiert IP-Literale ohne DNS-Abfrage", async () => {
    let called = false;
    const resolver = async () => {
      called = true;
      return ["8.8.8.8"];
    };
    await expect(
      assertPublicUrl("http://169.254.169.254/latest/meta-data/", { resolver }),
    ).rejects.toThrow(BlockedUrlError);
    expect(called).toBe(false);
  });

  it("blockiert localhost vor jeder Auflösung", async () => {
    await expect(
      assertPublicUrl("http://localhost:8080/admin", { resolver: publicResolver }),
    ).rejects.toThrow(BlockedUrlError);
  });

  it("blockiert, wenn kein DNS-Eintrag existiert", async () => {
    await expect(
      assertPublicUrl("https://example.com", { resolver: async () => [] }),
    ).rejects.toThrow(BlockedUrlError);
  });

  it("blockiert, wenn die Auflösung fehlschlägt", async () => {
    await expect(
      assertPublicUrl("https://example.com", {
        resolver: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
    ).rejects.toThrow(BlockedUrlError);
  });
});
