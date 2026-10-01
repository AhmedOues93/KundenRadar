import { describe, expect, it } from "vitest";
import { isSafeRedirect, safeRedirectTarget } from "@/lib/safe-redirect";

describe("isSafeRedirect – erlaubte Ziele", () => {
  it("lässt interne Pfade zu", () => {
    for (const target of [
      "/dashboard",
      "/leads",
      "/leads/discover",
      "/qualifizierung?score=HIGH",
      "/leads/123e4567-e89b-12d3-a456-426614174000",
      "/leads?search=M%C3%BCller",
      "/pipeline#spalte",
    ]) {
      expect(isSafeRedirect(target), target).toBe(true);
    }
  });
});

describe("isSafeRedirect – abgewiesene Ziele", () => {
  it("weist absolute Adressen ab", () => {
    for (const target of [
      "https://evil.example",
      "http://evil.example/pfad",
      "//evil.example",
      "javascript:alert(1)",
      "data:text/html,<script>",
    ]) {
      expect(isSafeRedirect(target), target).toBe(false);
    }
  });

  /**
   * Der Kern der Lücke: Browser normalisieren Backslashes in URLs zu
   * Schrägstrichen, `/\evil.example` wird also protokollrelativ.
   */
  it("weist über Backslash getarnte fremde Hosts ab", () => {
    for (const target of [
      "/\\evil.example",
      "/\\/evil.example",
      "/\\\\evil.example",
      "\\/evil.example",
      "/\\evil.example/pfad?x=1",
    ]) {
      expect(isSafeRedirect(target), JSON.stringify(target)).toBe(false);
    }
  });

  it("weist Steuerzeichen ab", () => {
    for (const target of ["/dashboard\nLocation: https://evil.example", "/da\u0000shboard", "/\tx"]) {
      expect(isSafeRedirect(target), JSON.stringify(target)).toBe(false);
    }
  });

  it("weist leere, relative und überlange Ziele ab", () => {
    expect(isSafeRedirect("")).toBe(false);
    expect(isSafeRedirect("dashboard")).toBe(false);
    expect(isSafeRedirect("../admin")).toBe(false);
    expect(isSafeRedirect(`/${"a".repeat(2000)}`)).toBe(false);
  });

  it("weist Nicht-Strings ab", () => {
    expect(isSafeRedirect(undefined as unknown as string)).toBe(false);
    expect(isSafeRedirect(null as unknown as string)).toBe(false);
  });
});

describe("safeRedirectTarget", () => {
  it("gibt sichere Ziele unverändert zurück", () => {
    expect(safeRedirectTarget("/leads")).toBe("/leads");
  });

  it("fällt bei unsicheren und fehlenden Zielen auf das Dashboard zurück", () => {
    expect(safeRedirectTarget("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectTarget("/\\evil.example")).toBe("/dashboard");
    expect(safeRedirectTarget(null)).toBe("/dashboard");
    expect(safeRedirectTarget(undefined)).toBe("/dashboard");
    expect(safeRedirectTarget("")).toBe("/dashboard");
  });

  it("erlaubt eine eigene Vorgabe", () => {
    expect(safeRedirectTarget("//evil.example", "/login")).toBe("/login");
  });
});
