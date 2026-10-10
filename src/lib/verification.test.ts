import { describe, expect, it } from "vitest";
import {
  DEMO_PROJECT_IDS,
  projectVerification,
  QP_VERIFIED_PROJECT_IDS,
  VERIFICATION_META,
} from "./verification";

describe("projectVerification", () => {
  it("la lista demo está vacía: ningún proyecto se marca demo", () => {
    for (const id of DEMO_PROJECT_IDS) {
      expect(projectVerification(id)).toBe("demo");
    }
  });

  it("proyectos desconocidos no reciben trazabilidad sin evidencia", () => {
    expect(projectVerification("00000000-0000-4000-8000-000000000000")).toBe("pending");
  });

  it("sin project_id la evidencia queda pendiente", () => {
    expect(projectVerification(null)).toBe("pending");
    expect(projectVerification(undefined)).toBe("pending");
  });

  it("QP verified tiene prioridad sobre demo si un ID estuviera en ambas listas", () => {
    // Hoy la lista QP está vacía por diseño (Fase 1 del roadmap).
    expect(QP_VERIFIED_PROJECT_IDS).toHaveLength(0);
  });

  it("todos los niveles tienen metadata completa para el badge", () => {
    for (const level of ["pending", "demo", "traceable", "qp_verified"] as const) {
      expect(VERIFICATION_META[level].label.length).toBeGreaterThan(0);
      expect(VERIFICATION_META[level].short.length).toBeGreaterThan(0);
      expect(VERIFICATION_META[level].description.length).toBeGreaterThan(20);
    }
  });
});
