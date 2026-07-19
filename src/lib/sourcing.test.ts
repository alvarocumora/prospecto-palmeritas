import { describe, expect, it } from "vitest";
import {
  generateSubmitToken,
  generateShareToken,
  isSubmitTokenFormat,
  isShareTokenFormat,
  tokenPrefix,
  summarizeSubmissions,
  normalizeSupplierRole,
  isOfferExpired,
  type SubmissionLike,
} from "./sourcing";

describe("tokens de sourcing", () => {
  it("genera tokens con el prefijo correcto y formato válido", () => {
    const submit = generateSubmitToken();
    const share = generateShareToken();
    expect(submit.startsWith("gcsrc_")).toBe(true);
    expect(share.startsWith("gcshr_")).toBe(true);
    expect(isSubmitTokenFormat(submit)).toBe(true);
    expect(isShareTokenFormat(share)).toBe(true);
  });

  it("no confunde un tipo de token con el otro", () => {
    expect(isShareTokenFormat(generateSubmitToken())).toBe(false);
    expect(isSubmitTokenFormat(generateShareToken())).toBe(false);
    expect(isSubmitTokenFormat("gcsrc_zzz")).toBe(false);
  });

  it("cada token es único", () => {
    expect(generateSubmitToken()).not.toBe(generateSubmitToken());
  });

  it("tokenPrefix recorta a prefijo + 6 chars", () => {
    const t = generateSubmitToken();
    expect(tokenPrefix(t)).toBe(t.slice(0, 12));
  });
});

describe("summarizeSubmissions", () => {
  const rows: SubmissionLike[] = [
    { status: "recibida", offer_price_usd_t: 8500 },
    { status: "preseleccionada", offer_price_usd_t: 8200 },
    { status: "descartada", offer_price_usd_t: 100 },
    { status: "recibida", offer_price_usd_t: null },
  ];

  it("cuenta total, preseleccionadas y mejor precio (excluye descartadas)", () => {
    const s = summarizeSubmissions(rows);
    expect(s.total).toBe(4);
    expect(s.shortlisted).toBe(1);
    expect(s.bestPriceUsdT).toBe(8200);
  });

  it("sin propuestas con precio → best null", () => {
    expect(
      summarizeSubmissions([{ status: "recibida", offer_price_usd_t: null }]).bestPriceUsdT,
    ).toBeNull();
  });

  it("lista vacía", () => {
    expect(summarizeSubmissions([])).toEqual({ total: 0, shortlisted: 0, bestPriceUsdT: null });
  });
});

describe("normalizeSupplierRole", () => {
  it("acepta roles conocidos (case-insensitive) y descarta el resto", () => {
    expect(normalizeSupplierRole("productor")).toBe("productor");
    expect(normalizeSupplierRole("BROKER")).toBe("broker");
    expect(normalizeSupplierRole("desconocido")).toBeNull();
    expect(normalizeSupplierRole(null)).toBeNull();
    expect(normalizeSupplierRole(undefined)).toBeNull();
  });
});

describe("isOfferExpired", () => {
  const now = new Date("2026-07-18T12:00:00Z");
  it("sin fecha = vigente", () => {
    expect(isOfferExpired(null, now)).toBe(false);
    expect(isOfferExpired(undefined, now)).toBe(false);
  });
  it("fecha futura = vigente; fecha pasada = vencida", () => {
    expect(isOfferExpired("2026-07-20", now)).toBe(false);
    expect(isOfferExpired("2026-07-18", now)).toBe(false); // vence al final del día
    expect(isOfferExpired("2026-07-16", now)).toBe(true);
  });
  it("fecha inválida = vigente (no rompe)", () => {
    expect(isOfferExpired("no-es-fecha", now)).toBe(false);
  });
});
