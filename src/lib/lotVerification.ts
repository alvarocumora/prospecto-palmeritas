// Agente "Know-Your-Mine": verificación de contraparte y activo de un lote de
// commodity contra la columna catastral-legal de la plataforma.
//
// Este módulo es la lógica DETERMINISTA de scoring (pura y testeable). El server
// fn (lotVerification.functions.ts) recopila las señales cruzando el lote →
// proyecto → concesiones contra SERNAGEOMIN, la nómina de remates (patent_remates)
// y el Boletín (mining_bulletins), y opcionalmente añade un dictamen narrativo
// generado por IA. El objetivo: convertir "confía en el vendedor" en evidencia
// verificable (¿controla la concesión?, ¿está vigente?, ¿tiene patente al día?).

export type FactorStatus = "pass" | "warn" | "fail" | "info";

export type VerificationFactor = {
  key: string;
  label: string;
  status: FactorStatus;
  detail: string;
};

export type LegalBreakdown = {
  constituidas: number;
  enTramite: number;
  eliminadas: number;
  unknown: number;
};

export type VerificationSignals = {
  hasProject: boolean;
  concessionCount: number;
  /** ¿El titular registrado de la concesión coincide con el vendedor? */
  titularMatch: "match" | "mismatch" | "unknown";
  legal: LegalBreakdown;
  remateCount: number; // concesiones en nómina de remate por patente impaga
  bulletinCount: number; // publicaciones de caducidad/eliminación/remate en el Boletín
  hasAssayReport: boolean;
  certificationCount: number;
  deleteriousDeclared: boolean; // declaró elementos penalizables (arsénico, etc.)
  originGeoreferenced: boolean; // origin_geojson presente
};

export type TrustLevel = "high" | "medium" | "low";

export type LotVerificationResult = {
  score: number; // 0..100
  level: TrustLevel;
  levelLabel: string;
  factors: VerificationFactor[];
  redFlags: VerificationFactor[];
};

function levelFromScore(score: number): { level: TrustLevel; levelLabel: string } {
  if (score >= 80) return { level: "high", levelLabel: "Alta confianza" };
  if (score >= 55) return { level: "medium", levelLabel: "Confianza media" };
  return { level: "low", levelLabel: "Riesgo — requiere revisión" };
}

/**
 * Puntúa la verificación de un lote a partir de las señales recopiladas.
 * Parte de 100 y descuenta por cada bandera; solo remate/patente impaga y
 * concesiones eliminadas son fallas duras (evidencia inequívoca). El desajuste
 * de titular es advertencia (el match es por nombre y admite falsos positivos).
 */
export function scoreLotVerification(s: VerificationSignals): LotVerificationResult {
  const factors: VerificationFactor[] = [];
  let score = 100;
  const deduct = (n: number) => {
    score -= n;
  };

  // 1. Vínculo del activo (¿el lote tiene origen catastral verificable?)
  if (!s.hasProject) {
    factors.push({
      key: "asset_link",
      label: "Vínculo del activo",
      status: "fail",
      detail: "Lote sin proyecto ni concesión vinculada: el origen no es verificable.",
    });
    deduct(35);
  } else if (s.concessionCount === 0) {
    factors.push({
      key: "asset_link",
      label: "Vínculo del activo",
      status: "warn",
      detail: "El proyecto vinculado no tiene concesiones registradas.",
    });
    deduct(18);
  } else {
    factors.push({
      key: "asset_link",
      label: "Vínculo del activo",
      status: "pass",
      detail: `Lote vinculado a ${s.concessionCount} concesión(es) del proyecto.`,
    });
  }

  // 2. Control del activo (titular vs. vendedor) — solo si hay concesiones
  if (s.hasProject && s.concessionCount > 0) {
    if (s.titularMatch === "match") {
      factors.push({
        key: "titular",
        label: "Control del activo",
        status: "pass",
        detail: "El titular registrado de la concesión coincide con el vendedor.",
      });
    } else if (s.titularMatch === "mismatch") {
      factors.push({
        key: "titular",
        label: "Control del activo",
        status: "warn",
        detail:
          "El titular registrado difiere del vendedor. Verificar mandato, cesión o contrato de compra antes de operar.",
      });
      deduct(15);
    } else {
      factors.push({
        key: "titular",
        label: "Control del activo",
        status: "warn",
        detail: "No fue posible confirmar que el vendedor sea el titular de la concesión.",
      });
      deduct(10);
    }
  }

  // 3. Vigencia legal
  if (s.legal.eliminadas > 0) {
    factors.push({
      key: "legal",
      label: "Vigencia legal",
      status: "fail",
      detail: `${s.legal.eliminadas} concesión(es) eliminada(s) o caducada(s) en SERNAGEOMIN.`,
    });
    deduct(28);
  } else if (s.legal.constituidas > 0) {
    factors.push({
      key: "legal",
      label: "Vigencia legal",
      status: "pass",
      detail: `${s.legal.constituidas} concesión(es) constituida(s) y vigente(s).`,
    });
  } else if (s.legal.enTramite > 0) {
    factors.push({
      key: "legal",
      label: "Vigencia legal",
      status: "warn",
      detail: "Concesiones en trámite: aún no constituidas.",
    });
    deduct(12);
  } else {
    factors.push({
      key: "legal",
      label: "Vigencia legal",
      status: "info",
      detail: "Estado legal de las concesiones no determinado.",
    });
    deduct(6);
  }

  // 4. Patente / remate (falla dura)
  if (s.remateCount > 0) {
    factors.push({
      key: "remate",
      label: "Patente al día",
      status: "fail",
      detail: `${s.remateCount} concesión(es) en nómina de remate por patente impaga.`,
    });
    deduct(30);
  } else {
    factors.push({
      key: "remate",
      label: "Patente al día",
      status: "pass",
      detail: "Sin remates por patente impaga detectados.",
    });
  }

  // 5. Actividad del Boletín
  if (s.bulletinCount > 0) {
    factors.push({
      key: "bulletin",
      label: "Boletín Oficial",
      status: "warn",
      detail: `${s.bulletinCount} publicación(es) reciente(s) en el Boletín (posible caducidad o remate).`,
    });
    deduct(8);
  } else {
    factors.push({
      key: "bulletin",
      label: "Boletín Oficial",
      status: "pass",
      detail: "Sin alertas del Boletín Oficial de Minería.",
    });
  }

  // 6. Trazabilidad del lote
  if (s.hasAssayReport) {
    factors.push({
      key: "assay",
      label: "Informe de ensaye",
      status: "pass",
      detail: "Informe de ensaye adjunto al lote.",
    });
  } else {
    factors.push({
      key: "assay",
      label: "Informe de ensaye",
      status: "warn",
      detail: "Sin informe de ensaye adjunto. Solicitar antes de la muestra.",
    });
    deduct(6);
  }

  if (s.certificationCount > 0) {
    factors.push({
      key: "certs",
      label: "Certificaciones",
      status: "pass",
      detail: `${s.certificationCount} certificación(es) cargada(s).`,
    });
  } else {
    factors.push({
      key: "certs",
      label: "Certificaciones",
      status: "warn",
      detail: "Sin certificaciones cargadas.",
    });
    deduct(5);
  }

  if (s.deleteriousDeclared) {
    factors.push({
      key: "deleterious",
      label: "Elementos penalizables",
      status: "pass",
      detail: "El vendedor declaró elementos penalizables (transparencia).",
    });
  } else {
    factors.push({
      key: "deleterious",
      label: "Elementos penalizables",
      status: "info",
      detail: "No se declararon elementos penalizables (arsénico, antimonio, etc.).",
    });
    deduct(3);
  }

  factors.push({
    key: "origin",
    label: "Origen georreferenciado",
    status: s.originGeoreferenced ? "pass" : "info",
    detail: s.originGeoreferenced
      ? "Origen del lote georreferenciado."
      : "Origen del lote sin georreferencia.",
  });
  if (!s.originGeoreferenced) deduct(2);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const { level, levelLabel } = levelFromScore(score);
  return {
    score,
    level,
    levelLabel,
    factors,
    redFlags: factors.filter((f) => f.status === "fail"),
  };
}

/** Clasifica un texto de situación SERNAGEOMIN en el desglose legal. */
export function classifyLegalStatus(status: string | null): keyof LegalBreakdown {
  const s = (status ?? "").toUpperCase();
  if (s.includes("ELIMIN") || s.includes("CADUC")) return "eliminadas";
  if (s.includes("TRAMITE") || s.includes("TRÁMITE")) return "enTramite";
  if (s.includes("CONSTITU") || s.includes("VIGENTE")) return "constituidas";
  return "unknown";
}
