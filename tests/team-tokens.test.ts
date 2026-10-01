import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  INVITATION_TTL_DAYS,
  isPlausibleToken,
  tokenHashesMatch,
} from "@/lib/team/tokens";
import { invitationStatus, INVITATION_STATUS_LABELS, INVITATION_STATUSES } from "@/lib/team/types";

describe("createInvitationToken", () => {
  it("erzeugt URL-sichere Tokens ausreichender Länge", () => {
    for (let i = 0; i < 20; i += 1) {
      const token = createInvitationToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(43);
    }
  });

  it("erzeugt bei jedem Aufruf ein anderes Token", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => createInvitationToken()));
    expect(tokens.size).toBe(200);
  });
});

describe("hashInvitationToken", () => {
  /**
   * Der Hash muss exakt dem entsprechen, was die Migration berechnet:
   * encode(digest(token, 'sha256'), 'hex').
   */
  it("entspricht sha256 als Hex", () => {
    const token = "beispiel-token-abcdefghijklmnop";
    const erwartet = createHash("sha256").update(token, "utf8").digest("hex");
    expect(hashInvitationToken(token)).toBe(erwartet);
    expect(hashInvitationToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ist stabil und unterscheidet verschiedene Tokens", () => {
    expect(hashInvitationToken("a-token")).toBe(hashInvitationToken("a-token"));
    expect(hashInvitationToken("a-token")).not.toBe(hashInvitationToken("b-token"));
  });

  it("gibt das Token nicht preis", () => {
    const token = createInvitationToken();
    expect(hashInvitationToken(token)).not.toContain(token);
  });
});

describe("isPlausibleToken", () => {
  it("akzeptiert erzeugte Tokens", () => {
    expect(isPlausibleToken(createInvitationToken())).toBe(true);
  });

  it("weist zu kurze, zu lange und fremde Zeichen ab", () => {
    expect(isPlausibleToken("kurz")).toBe(false);
    expect(isPlausibleToken("a".repeat(100))).toBe(false);
    expect(isPlausibleToken(`${"a".repeat(40)}/../../etc`)).toBe(false);
    expect(isPlausibleToken("")).toBe(false);
    expect(isPlausibleToken(undefined as unknown as string)).toBe(false);
  });
});

describe("tokenHashesMatch", () => {
  it("vergleicht gleich lange Werte korrekt", () => {
    const hash = hashInvitationToken("x-token-mit-genug-laenge");
    expect(tokenHashesMatch(hash, hash)).toBe(true);
    expect(tokenHashesMatch(hash, hashInvitationToken("anderes"))).toBe(false);
  });

  it("meldet unterschiedliche Längen als ungleich", () => {
    expect(tokenHashesMatch("kurz", "laenger")).toBe(false);
  });
});

describe("invitationExpiry", () => {
  it("liegt 14 Tage in der Zukunft", () => {
    const jetzt = new Date("2026-10-01T12:00:00Z");
    const ablauf = invitationExpiry(jetzt);
    const tage = (ablauf.getTime() - jetzt.getTime()) / (24 * 60 * 60 * 1000);
    expect(tage).toBe(INVITATION_TTL_DAYS);
  });
});

describe("invitationStatus", () => {
  const zukunft = new Date(Date.now() + 86_400_000).toISOString();
  const vergangenheit = new Date(Date.now() - 86_400_000).toISOString();

  it("erkennt offene Einladungen", () => {
    expect(invitationStatus({ accepted_at: null, revoked_at: null, expires_at: zukunft })).toBe(
      "PENDING",
    );
  });

  it("erkennt abgelaufene Einladungen", () => {
    expect(invitationStatus({ accepted_at: null, revoked_at: null, expires_at: vergangenheit })).toBe(
      "EXPIRED",
    );
  });

  it("erkennt angenommene Einladungen auch nach Ablauf", () => {
    expect(
      invitationStatus({ accepted_at: vergangenheit, revoked_at: null, expires_at: vergangenheit }),
    ).toBe("ACCEPTED");
  });

  it("gibt dem Rückzug Vorrang", () => {
    expect(
      invitationStatus({ accepted_at: vergangenheit, revoked_at: vergangenheit, expires_at: zukunft }),
    ).toBe("REVOKED");
  });

  it("benennt jeden Status", () => {
    for (const status of INVITATION_STATUSES) {
      expect(INVITATION_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});
