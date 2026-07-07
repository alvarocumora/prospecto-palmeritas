import { describe, expect, it } from "vitest";
import {
  scoreLotVerification,
  classifyLegalStatus,
  type VerificationSignals,
} from "./lotVerification";

function signals(over: Partial<VerificationSignals> = {}): VerificationSignals {
  return {
    hasProject: true,
    concessionCount: 2,
    titularMatch: "match",
    legal: { constituidas: 2, enTramite: 0, eliminadas: 0, unknown: 0 },
    remateCount: 0,
    bulletinCount: 0,
    hasAssayReport: true,
    certificationCount: 3,
    deleteriousDeclared: true,
    originGeoreferenced: true,
    ...over,
  };
}

describe("classifyLegalStatus", () => {
  it("clasifica las situaciones de SERNAGEOMIN", () => {
    expect(classifyLegalStatus("CONSTITUIDA")).toBe("constituidas");
    expect(classifyLegalStatus("Vigente")).toBe("constituidas");
    expect(classifyLegalStatus("EN TRAMITE")).toBe("enTramite");
    expect(classifyLegalStatus("ELIMINADA")).toBe("eliminadas");
    expect(classifyLegalStatus("caducada")).toBe("eliminadas");
    expect(classifyLegalStatus(null)).toBe("unknown");
    expect(classifyLegalStatus("otra cosa")).toBe("unknown");
  });
});

describe("scoreLotVerification", () => {
  it("lote limpio y completo → alta confianza", () => {
    const r = scoreLotVerification(signals());
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.level).toBe("high");
    expect(r.redFlags).toHaveLength(0);
  });

  it("remate por patente impaga → falla dura y baja el score", () => {
    const r = scoreLotVerification(signals({ remateCount: 1 }));
    expect(r.redFlags.some((f) => f.key === "remate")).toBe(true);
    expect(r.score).toBeLessThan(80);
  });

  it("concesión eliminada → falla dura", () => {
    const r = scoreLotVerification(
      signals({ legal: { constituidas: 0, enTramite: 0, eliminadas: 1, unknown: 0 } }),
    );
    expect(r.redFlags.some((f) => f.key === "legal")).toBe(true);
  });

  it("sin proyecto vinculado → riesgo y bandera de activo", () => {
    const r = scoreLotVerification(
      signals({ hasProject: false, concessionCount: 0, titularMatch: "unknown" }),
    );
    expect(r.redFlags.some((f) => f.key === "asset_link")).toBe(true);
    // sin proyecto no se agrega el factor de titular
    expect(r.factors.some((f) => f.key === "titular")).toBe(false);
  });

  it("titular no coincidente es advertencia, no falla dura", () => {
    const r = scoreLotVerification(signals({ titularMatch: "mismatch" }));
    const titular = r.factors.find((f) => f.key === "titular");
    expect(titular?.status).toBe("warn");
    expect(r.redFlags.some((f) => f.key === "titular")).toBe(false);
  });

  it("acumulación de banderas lleva a nivel bajo", () => {
    const r = scoreLotVerification(
      signals({
        remateCount: 2,
        legal: { constituidas: 0, enTramite: 0, eliminadas: 1, unknown: 0 },
        titularMatch: "mismatch",
        bulletinCount: 1,
      }),
    );
    expect(r.level).toBe("low");
  });

  it("score se mantiene en el rango 0..100", () => {
    const r = scoreLotVerification(
      signals({
        hasProject: false,
        concessionCount: 0,
        titularMatch: "unknown",
        legal: { constituidas: 0, enTramite: 0, eliminadas: 3, unknown: 0 },
        remateCount: 3,
        bulletinCount: 3,
        hasAssayReport: false,
        certificationCount: 0,
        deleteriousDeclared: false,
        originGeoreferenced: false,
      }),
    );
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
