import { describe, it, expect } from "vitest";
import { mapOverlapRow, summarizeOverlaps, tenureSemaphore, type TenureOverlap } from "./overlaps";

const row = (over: Partial<TenureOverlap> = {}): TenureOverlap => ({
  concessionId: "c",
  projectId: null,
  code: null,
  name: null,
  holder: null,
  concessionType: null,
  status: null,
  areaHa: null,
  commune: null,
  region: null,
  expiresAt: null,
  overlapHa: 0,
  pctOfAoi: 0,
  pctOfConcession: 0,
  severity: "info",
  ...over,
});

describe("tenencia/overlaps · mapOverlapRow", () => {
  it("mapea la fila snake_case del RPC y normaliza severidad", () => {
    const m = mapOverlapRow({
      concession_id: "abc",
      project_id: "p1",
      code: "C-1",
      name: "Vecina",
      holder: "Minera X",
      concession_type: "explotacion",
      status: "vigente",
      area_ha: "428.1",
      commune: "La Serena",
      region: "Coquimbo",
      expires_at: "2030-01-01",
      overlap_ha: "160.54",
      pct_of_aoi: "66.7",
      pct_of_concession: "37.5",
      severity: "blocking",
    });
    expect(m.concessionId).toBe("abc");
    expect(m.areaHa).toBe(428.1);
    expect(m.overlapHa).toBeCloseTo(160.54);
    expect(m.severity).toBe("blocking");
  });
  it("cae a 'info' ante severidad desconocida y a 0 ante nulos", () => {
    const m = mapOverlapRow({ concession_id: "x", severity: "raro" });
    expect(m.severity).toBe("info");
    expect(m.overlapHa).toBe(0);
    expect(m.areaHa).toBeNull();
  });
});

describe("tenencia/overlaps · summarizeOverlaps", () => {
  it("cuenta por severidad, suma hectáreas y titulares únicos", () => {
    const s = summarizeOverlaps([
      row({ severity: "blocking", overlapHa: 100, pctOfAoi: 40, holder: "Minera X" }),
      row({ severity: "warning", overlapHa: 50, pctOfAoi: 20, holder: "Minera X" }),
      row({ severity: "info", overlapHa: 10, pctOfAoi: 5, holder: "Minera Y" }),
    ]);
    expect(s.total).toBe(3);
    expect(s.blocking).toBe(1);
    expect(s.warning).toBe(1);
    expect(s.info).toBe(1);
    expect(s.totalOverlapHa).toBe(160);
    expect(s.maxPctOfAoi).toBe(40);
    expect(s.uniqueHolders).toBe(2); // Minera X (x2) + Minera Y
    expect(s.worstSeverity).toBe("blocking");
  });
  it("lista vacía → todo en cero y worstSeverity none", () => {
    const s = summarizeOverlaps([]);
    expect(s.total).toBe(0);
    expect(s.worstSeverity).toBe("none");
  });
});

describe("tenencia/overlaps · tenureSemaphore", () => {
  it("rojo si hay bloqueantes, amarillo si hay warnings, verde si limpio", () => {
    expect(tenureSemaphore(summarizeOverlaps([row({ severity: "blocking" })]))).toBe("rojo");
    expect(tenureSemaphore(summarizeOverlaps([row({ severity: "warning" })]))).toBe("amarillo");
    expect(tenureSemaphore(summarizeOverlaps([row({ severity: "info" })]))).toBe("verde");
    expect(tenureSemaphore(summarizeOverlaps([]))).toBe("verde");
  });
});
