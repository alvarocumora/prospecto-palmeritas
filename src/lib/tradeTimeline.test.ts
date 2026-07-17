import { describe, expect, it } from "vitest";
import { JOURNEY_STEPS, journeyStep, journeyHeadline, normalizeEvent } from "./tradeTimeline";

describe("journeyStep", () => {
  it("mapea etapas comerciales sin embarque", () => {
    expect(journeyStep("icpo", null)).toBe(0);
    expect(journeyStep("fco", null)).toBe(0);
    expect(journeyStep("spa", null)).toBe(1);
    expect(journeyStep("payment", null)).toBe(2);
    expect(journeyStep("shipping", null)).toBe(3);
    expect(journeyStep("delivered", null)).toBe(5);
    expect(journeyStep("closed", null)).toBe(5);
  });

  it("la carga puede ir por delante del papeleo (max de ambos)", () => {
    expect(journeyStep("shipping", "on_water")).toBe(4);
    expect(journeyStep("payment", "on_water")).toBe(4);
    expect(journeyStep("shipping", "arrived")).toBe(4);
    expect(journeyStep("shipping", "delivered")).toBe(5);
  });

  it("la etapa comercial manda si va más avanzada que el embarque", () => {
    expect(journeyStep("delivered", "preparing")).toBe(5);
  });

  it("etapa desconocida cae al paso 0 y el rango es válido", () => {
    expect(journeyStep("???", null)).toBe(0);
    expect(journeyStep("closed", "delivered")).toBeLessThan(JOURNEY_STEPS.length);
  });
});

describe("journeyHeadline", () => {
  it("titulares por paso", () => {
    expect(journeyHeadline(0)).toMatch(/acuerdo/i);
    expect(journeyHeadline(1)).toMatch(/SPA/);
    expect(journeyHeadline(2)).toMatch(/pago/i);
    expect(journeyHeadline(3)).toMatch(/embarque/i);
    expect(journeyHeadline(5)).toMatch(/entregada/i);
  });

  it("en tránsito incluye nave y ETA si existen", () => {
    const h = journeyHeadline(4, { vessel: "MV Atacama", etaIso: "2026-08-12" });
    expect(h).toContain("en tránsito");
    expect(h).toContain("MV Atacama");
    expect(h).toContain("ETA");
  });

  it("en tránsito sin datos opcionales sigue siendo legible", () => {
    expect(journeyHeadline(4)).toBe("Tu carga está en tránsito");
  });

  it("arribo a destino tiene su propio titular", () => {
    expect(journeyHeadline(4, { arrived: true })).toMatch(/arribada/i);
  });
});

describe("normalizeEvent", () => {
  const base = { id: "e1", detail: null, doc_type: null, created_at: "2026-07-17T10:00:00Z" };

  it("created → inicio de la operación", () => {
    const it_ = normalizeEvent({ ...base, kind: "created" });
    expect(it_.category).toBe("trade");
    expect(it_.title).toBe("Operación iniciada");
  });

  it("stage_changed usa etiquetas legibles de la etapa", () => {
    expect(normalizeEvent({ ...base, kind: "stage_changed", detail: "spa" }).title).toBe(
      "SPA en curso",
    );
    expect(normalizeEvent({ ...base, kind: "stage_changed", detail: "closed" }).title).toBe(
      "Operación cerrada",
    );
    expect(normalizeEvent({ ...base, kind: "stage_changed", detail: "rara" }).title).toBe(
      "Etapa: rara",
    );
  });

  it("eventos de documentos incluyen el tipo en mayúsculas", () => {
    expect(normalizeEvent({ ...base, kind: "doc_uploaded", doc_type: "spa" }).title).toBe(
      "Documento subido: SPA",
    );
    const signed = normalizeEvent({ ...base, kind: "doc_signed", doc_type: "nda" });
    expect(signed.category).toBe("document");
    expect(signed.title).toBe("Documento firmado: NDA");
    expect(normalizeEvent({ ...base, kind: "doc_verified", doc_type: null }).title).toBe(
      "Documento verificado",
    );
  });

  it("eventos de embarque quedan en la categoría shipment", () => {
    const created = normalizeEvent({ ...base, kind: "shipment_created", detail: "SHP-X" });
    expect(created.category).toBe("shipment");
    expect(created.title).toBe("Embarque creado");
    const status = normalizeEvent({
      ...base,
      kind: "shipment_status",
      detail: "preparing → at_port",
    });
    expect(status.category).toBe("shipment");
    expect(status.detail).toBe("preparing → at_port");
  });

  it("mensajes y kinds desconocidos no rompen el timeline", () => {
    expect(normalizeEvent({ ...base, kind: "message", detail: "hola" }).category).toBe("message");
    const unknown = normalizeEvent({ ...base, kind: "algo_nuevo", detail: "x" });
    expect(unknown.category).toBe("trade");
    expect(unknown.title).toBe("algo_nuevo");
  });
});
