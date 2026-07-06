import { describe, expect, it } from "vitest";
import {
  mergeLegalAlerts,
  summarizeLegalAlerts,
  type BulletinAlertInput,
  type CourtAlertInput,
} from "./legalAlerts";

function bAlert(over: Partial<BulletinAlertInput> = {}): BulletinAlertInput {
  return {
    id: over.id ?? "b1",
    match_type: over.match_type ?? "holder",
    match_detail: over.match_detail ?? null,
    is_read: over.is_read ?? false,
    created_at: over.created_at ?? "2026-07-01T00:00:00Z",
    bulletin: over.bulletin ?? {
      publication_type: "manifestacion",
      concession_name: "ESTHERCITA 1/6",
      concession_code: "63010070-4",
      holder_name: "Minera X",
      holder_rut: null,
      comuna: "Pichilemu",
      region: "O'Higgins",
      source_url: null,
      raw_payload: null,
    },
  };
}

function cAlert(over: Partial<CourtAlertInput> = {}): CourtAlertInput {
  return {
    id: over.id ?? "c1",
    match_type: over.match_type ?? "defendant_name",
    match_detail: over.match_detail ?? null,
    is_read: over.is_read ?? false,
    created_at: over.created_at ?? "2026-07-02T00:00:00Z",
    case: over.case ?? {
      case_number: "C-123-2026",
      court: "1º JL Santa Cruz",
      matter: "remate patente",
      defendant: "Minera X",
      defendant_rut: "76123456-7",
      comuna: "Santa Cruz",
      region: "O'Higgins",
      source_url: "https://pjud.cl/x",
    },
  };
}

describe("mergeLegalAlerts", () => {
  it("clasifica remate como crítico y extrae monto/año del raw_payload", () => {
    const [a] = mergeLegalAlerts(
      [
        bAlert({
          id: "r1",
          match_type: "remate",
          bulletin: {
            publication_type: "remate",
            concession_name: "MINA SUR",
            concession_code: "111-2",
            holder_name: "Deudor SpA",
            holder_rut: "60000000-0",
            comuna: "Copiapó",
            region: "Atacama",
            source_url: null,
            raw_payload: { year: 2026, amount_clp: "1.250.000" },
          },
        }),
      ],
      [],
    );
    expect(a.kind).toBe("remate");
    expect(a.severity).toBe("critical");
    expect(a.badge).toBe("Remate");
    expect(a.amountClp).toBe(1250000);
    expect(a.year).toBe(2026);
  });

  it("clasifica PJUD como advertencia y boletín normal como info", () => {
    const merged = mergeLegalAlerts([bAlert()], [cAlert()]);
    const boletin = merged.find((m) => m.source === "bulletin");
    const pjud = merged.find((m) => m.source === "court");
    expect(boletin?.kind).toBe("boletin");
    expect(boletin?.severity).toBe("info");
    expect(pjud?.kind).toBe("pjud");
    expect(pjud?.severity).toBe("warning");
    expect(pjud?.badge).toBe("Demandado");
  });

  it("ordena: no leídas primero, luego por severidad, luego por fecha", () => {
    const merged = mergeLegalAlerts(
      [
        bAlert({ id: "leida-remate", match_type: "remate", is_read: true }),
        bAlert({ id: "info-nueva", is_read: false, created_at: "2026-07-05T00:00:00Z" }),
        bAlert({
          id: "remate-nuevo",
          match_type: "remate",
          is_read: false,
          created_at: "2026-07-03T00:00:00Z",
          bulletin: {
            publication_type: "remate",
            concession_name: "R",
            concession_code: "9-9",
            holder_name: null,
            holder_rut: null,
            comuna: null,
            region: null,
            source_url: null,
            raw_payload: null,
          },
        }),
      ],
      [],
    );
    // remate no leído (crítico) va primero, aunque sea más antiguo que info-nueva
    expect(merged[0].alertId).toBe("remate-nuevo");
    expect(merged[1].alertId).toBe("info-nueva");
    // la leída queda al final
    expect(merged[merged.length - 1].alertId).toBe("leida-remate");
  });

  it("badge por match_type de boletín", () => {
    const aoi = mergeLegalAlerts([bAlert({ match_type: "aoi" })], [])[0];
    const rut = mergeLegalAlerts([bAlert({ match_type: "holder_rut" })], [])[0];
    const titular = mergeLegalAlerts([bAlert({ match_type: "holder_name" })], [])[0];
    expect(aoi.badge).toBe("AOI");
    expect(rut.badge).toBe("RUT");
    expect(titular.badge).toBe("Titular");
  });
});

describe("summarizeLegalAlerts", () => {
  it("cuenta por tipo y no leídas", () => {
    const merged = mergeLegalAlerts(
      [
        bAlert({ id: "b1", is_read: false }),
        bAlert({ id: "r1", match_type: "remate", is_read: true }),
      ],
      [cAlert({ id: "c1", is_read: false })],
    );
    const s = summarizeLegalAlerts(merged);
    expect(s.total).toBe(3);
    expect(s.unread).toBe(2);
    expect(s.remate).toBe(1);
    expect(s.boletin).toBe(1);
    expect(s.pjud).toBe(1);
  });
});
