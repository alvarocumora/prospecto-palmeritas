import { describe, expect, it } from "vitest";
import {
  formatLegalQuoteMessage,
  quoteTotalAreaHa,
  validateLegalQuote,
  type LegalQuoteDetails,
} from "./legalQuote";

const BASE: LegalQuoteDetails = {
  service: "pedimento",
  region: "Coquimbo",
  comuna: "Illapel",
  areaHa: 300,
  requestCount: 3,
  applicantType: "sociedad",
  hasDesign: true,
  timing: "evaluacion",
};

describe("legalQuote", () => {
  it("limita cada pedimento a 5.000 ha", () => {
    expect(validateLegalQuote({ ...BASE, areaHa: 5000 })).toBeNull();
    expect(validateLegalQuote({ ...BASE, areaHa: 5001 })).toContain("5.000 ha");
  });

  it("exige pertenencias de manifestación entre 1 y 10 ha", () => {
    expect(validateLegalQuote({ ...BASE, service: "manifestacion", areaHa: 0.5 })).toContain("1 y 10 ha");
    expect(validateLegalQuote({ ...BASE, service: "manifestacion", areaHa: 11 })).toContain("1 y 10 ha");
    expect(validateLegalQuote({ ...BASE, service: "manifestacion", areaHa: 10 })).toBeNull();
  });

  it("calcula la superficie total y adjunta el alcance a la solicitud", () => {
    expect(quoteTotalAreaHa(BASE)).toBe(900);
    const message = formatLegalQuoteMessage(BASE, {
      name: "María Soto",
      email: "maria@minera.cl",
      notes: "Existen labores antiguas declaradas.",
    });
    expect(message).toContain("Pedimento minero");
    expect(message).toContain("300 ha");
    expect(message).toContain("900 ha");
    expect(message).toContain("Illapel");
    expect(message).toContain("a confirmar");
    expect(message).toContain("no confirma vacancia");
  });
});
