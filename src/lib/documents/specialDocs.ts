// Documentos "especiales" que no vienen de plantillas editables:
// se generan con el mismo renderer Institutional Modernist (QR + logo +
// tabulación estándar) para que compartan formato con NDA / LOI / NCNDA.

import type { GeneratedDoc } from "./model";
import { renderGeocapitalsPdf } from "./pdf";

const today = () => new Date().toISOString().slice(0, 10);

// ─────────────────────────── Proyecto Aurífero 4M oz ───────────────────────

export function buildGoldNda(): GeneratedDoc {
  return {
    docType: "NDA",
    reference: "GC-NDA-AU-202607-9001",
    date: today(),
    title:
      "Acuerdo de Confidencialidad — Proyecto Aurífero (4.000.000 oz Au · NI 43-101)",
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Divulgante", "Geocapitals SpA · info@geocapitals.com · +56 9 6218 4071"],
          ["Receptor", "[Razón social + Tax ID de la contraparte]"],
          ["Proyecto", "Proyecto Aurífero — Reserva 4,0 Moz Au (NI 43-101 completo)"],
          ["Ticket referencial", "USD 900.000.000"],
          ["Modalidad", "Mutuo · Confidencialidad recíproca"],
          ["Vigencia", "24 meses desde la firma"],
          ["Jurisdicción", "República de Chile · CAM Santiago"],
        ],
      },
      {
        kind: "paragraph",
        text: "El presente instrumento regula el intercambio de información confidencial entre Geocapitals SpA (la Divulgante) y el Receptor, con el propósito exclusivo de evaluar una potencial transacción sobre el Proyecto Aurífero identificado, incluyendo su recurso, reservas certificadas bajo NI 43-101, valoración, estructura societaria y data room técnica y financiera.",
      },
      {
        kind: "clauses",
        items: [
          "1. Objeto. Regular el intercambio y protección de información técnica, geológica, metalúrgica, financiera, comercial y legal del Proyecto Aurífero.",
          "2. Información confidencial. Incluye — sin limitarse a — el informe NI 43-101, modelos de bloques, reservas y recursos, estados financieros, títulos mineros, contratos, comunicaciones y cualquier material entregado en el data room de Geocapitals.",
          "3. Uso. La información se utilizará exclusivamente para la evaluación de la transacción. No podrá copiarse, publicarse ni compartirse con terceros sin autorización previa y por escrito de la Divulgante.",
          "4. Círculo autorizado. El Receptor podrá compartir la información con sus asesores, financistas y equipo técnico bajo idéntica obligación de confidencialidad, respondiendo por sus actos.",
          "5. No elusión (non-circumvention). El Receptor se obliga a no contactar, negociar ni contratar directa o indirectamente con los titulares, financistas o contrapartes identificados por la Divulgante durante la vigencia del acuerdo y por 12 meses adicionales.",
          "6. Vigencia. Las obligaciones tendrán una duración de 24 meses contados desde la firma, subsistiendo respecto de la información recibida durante dicho período.",
          "7. Devolución. Al término del propósito, o a requerimiento de la Divulgante, el Receptor devolverá o destruirá toda la información confidencial y certificará por escrito dicha destrucción.",
          "8. Penalidad. El incumplimiento dará derecho a una indemnización mínima equivalente a US$ 250.000, sin perjuicio de los daños adicionales que se acrediten.",
          "9. Ley aplicable y arbitraje. Se rige por las leyes de la República de Chile. Las controversias se someterán al arbitraje del Centro de Arbitraje y Mediación (CAM) de la Cámara de Comercio de Santiago.",
          "10. Firma electrónica. Las Partes aceptan la firma electrónica y la trazabilidad QR emitida por la plataforma Geocapitals como medio válido de expresión del consentimiento.",
        ],
      },
      { kind: "signature", parties: ["Por Geocapitals SpA", "Por el Receptor"] },
    ],
  };
}

export function buildGoldFicha(): GeneratedDoc {
  return {
    docType: "FICHA",
    reference: "GC-FICHA-AU-202607-9001",
    date: today(),
    title: "Ficha de Consulta — Proyecto Aurífero 4,0 Moz Au (NI 43-101)",
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Commodity", "Oro (Au)"],
          ["Reservas certificadas", "4.000.000 oz Au (NI 43-101 completo)"],
          ["Categoría", "Reservas Probadas + Probables (informe QP vigente)"],
          ["Ticket de venta", "USD 900.000.000"],
          ["Múltiplo implícito", "≈ USD 225 / oz Au reserva"],
          ["Etapa del proyecto", "Feasibility · NI 43-101 vigente"],
          ["Modalidad", "Venta 100% · Estructuras alternativas negociables"],
          ["Acceso", "Bajo NDA · Data room controlado por Geocapitals"],
          ["Contacto", "info@geocapitals.com · +56 9 6218 4071"],
        ],
      },
      {
        kind: "paragraph",
        text: "Proyecto aurífero con recurso y reservas certificadas bajo estándar NI 43-101 por Persona Calificada (QP) independiente. Se ofrece bajo estricta confidencialidad a compradores estratégicos y financieros previamente calificados. La presente ficha es un resumen ejecutivo — la información técnica completa (informe NI 43-101, modelo de bloques, plan minero, estudios metalúrgicos, títulos y contratos) se libera únicamente en el data room de Geocapitals una vez firmado el NDA de referencia GC-NDA-AU-202607-9001.",
      },
      {
        kind: "table",
        head: ["Métrica", "Valor", "Nota"],
        rows: [
          ["Reservas Au", "4,0 Moz", "Certificadas NI 43-101"],
          ["Ticket", "USD 900 M", "100% equity o estructuras híbridas"],
          ["USD / oz reserva", "≈ 225", "Comparable a M&A senior producers"],
          ["Referencia peers", "USD 150 – 300 / oz", "Barrick, Newmont, Kinross 2023-2025"],
          ["Upside implícito", "20 – 30%", "Sujeto a due diligence técnica y legal"],
        ],
      },
      {
        kind: "clauses",
        items: [
          "1. Firma del NDA (Ref. GC-NDA-AU-202607-9001) por el comprador o su representante autorizado.",
          "2. Verificación de calificación del inversionista (proof of funds y buyer profile).",
          "3. Acceso al data room técnico y financiero, con trazabilidad de accesos por usuario.",
          "4. Reuniones QP · Q&A técnico agendado con el equipo geológico responsable del informe NI 43-101.",
          "5. Emisión de LOI vinculante y calendario de due diligence hacia SPA definitivo.",
        ],
      },
      {
        kind: "paragraph",
        text: "Este documento no constituye oferta pública ni recomendación de inversión. Toda información deberá ser verificada por el comprador en el proceso de due diligence. Geocapitals actúa como advisor de la operación y coordina la comunicación con el titular del proyecto.",
      },
    ],
  };
}

// ─────────────────────────── Adenda TRENTO (REE) ───────────────────────────

export function buildTrentoAdenda(): GeneratedDoc {
  return {
    docType: "ADENDA",
    reference: "GC-ADENDA-REE-TRENTO-202607-1",
    date: today(),
    title:
      "Adenda técnica — Proyecto TRENTO · Mineralogía objetivo: monacita / bastnasita",
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Proyecto", "TRENTO — Tierras Raras (REE)"],
          ["Emisor", "Geocapitals SpA · info@geocapitals.com · +56 9 6218 4071"],
          ["Documento base", "Ficha TRENTO (informe ALS · 189 muestras)"],
          ["ΣREE máx.", "2.055 ppm ≈ 0,21% TREO"],
          ["Firma geoquímica", "Ce > La > Nd > Pr (>90% ΣREE)"],
          ["LREE / HREE", "≈ 9,46 · Firma LREE dominante"],
          ["Alcance", "Diagnóstico mineralógico + ruta metalúrgica + plan 60-90 días"],
        ],
      },
      {
        kind: "paragraph",
        text: "La presente adenda complementa la ficha del Proyecto TRENTO con un diagnóstico mineralógico específico sobre monacita ((Ce,La,Nd,Th)PO₄) y bastnasita ((Ce,La)CO₃F), los dos minerales madre típicos de las tierras raras livianas (LREE). El objetivo es dimensionar la factibilidad económica y definir el plan técnico de confirmación previo a un modelo de bloques y estudio metalúrgico formal.",
      },
      {
        kind: "table",
        head: ["Mineral", "Fórmula", "Densidad", "Respuesta metalúrgica"],
        rows: [
          ["Monacita", "(Ce,La,Nd,Th)PO₄", "5,0", "Gravimétrica + magnética (paramagnética)"],
          ["Bastnasita", "(Ce,La)CO₃F", "4,9", "Gravimétrica + flotación (colectores de ácido graso)"],
          ["Xenotima (descartada)", "YPO₄", "4,4-5,1", "HREE-dominante — no coincide con firma TRENTO"],
        ],
      },
      {
        kind: "clauses",
        items: [
          "1. Encaje mineralógico. La firma Ce+La+Nd+Pr > 90% ΣREE y LREE/HREE ≈ 9,46 es diagnóstica de monacita y/o bastnasita, no de xenotima. Coincide con el orden Ce > La > Nd > Pr observado en las muestras top (1020, 1007, 1008…).",
          "2. Feasibilidad económica. Ley global ~0,21% TREO. Como REE standalone es baja (peers: Mountain Pass ~7%, Mount Weld ~9%). Vías viables: (a) by-product de Fe/fosfatos/placeres, (b) alto tonelaje + baja stripping (modelo IOCG/carbonatita), (c) upgrade metalúrgico gravimétrico+magnético a concentrado 30-60% TREO.",
          "3. Valor indicativo. Con canasta LREE mixta ~USD 8-12/kg TREO y 0,2% TREO → USD 16-24 por tonelada de roca in-situ. El negocio se sustenta en volumen + upgrade a concentrado, no en ley de cabeza.",
          "4. Plan de confirmación 60-90 días. (i) QEMSCAN/XRD para cuantificar monacita vs bastnasita vs apatito/allanita. (ii) Análisis Th/U (define ruta metalúrgica y permisos). (iii) Ensayos de liberación a distintos p80 y flowsheet gravimétrico + flotación. (iv) Levantamiento topográfico y muestreo sistemático para modelo de bloques.",
          "5. Entregables. Reporte mineralógico, flowsheet preliminar, memo de permisos por Th, y estimación in-situ TREO para pasar a ficha comercial actualizada bajo NDA.",
        ],
      },
      {
        kind: "paragraph",
        text: "Esta adenda es parte del expediente TRENTO bajo NDA y no constituye oferta ni recomendación de inversión. La información técnica adicional se libera únicamente en el data room controlado por Geocapitals.",
      },
    ],
  };
}

// ─────────────────────── Ficha TRENTO · Monacita / Bastnasita ─────────────

export function buildTrentoMonaBastFicha(): GeneratedDoc {
  return {
    docType: "FICHA",
    reference: "GC-FICHA-REE-TRENTO-MB-202607-1",
    date: today(),
    title:
      "Ficha comercial — Proyecto TRENTO · Concentrado LREE (Monacita / Bastnasita)",
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Proyecto", "TRENTO — Tierras Raras Livianas (LREE)"],
          ["Emisor", "Geocapitals SpA · info@geocapitals.com · +56 9 6218 4071"],
          ["Mineralogía objetivo", "Monacita ((Ce,La,Nd,Th)PO₄) + Bastnasita ((Ce,La)CO₃F)"],
          ["Producto ofrecido", "Concentrado LREE 30–60% TREO (upgrade gravimétrico + flotación)"],
          ["Base analítica", "189 muestras ALS · método ME-MS82 · 15 elementos REE + Y"],
          ["Firma geoquímica", "Ce > La > Nd > Pr · Ce+La+Nd+Pr > 90% ΣREE"],
          ["Ratio LREE/HREE", "≈ 9,46 (LREE dominante)"],
          ["ΣREE máx. muestra", "2.055 ppm (~0,21% TREO)"],
          ["Etapa", "Exploración avanzada · Confirmación 60-90 días en curso"],
          ["Acceso", "Bajo NDA · Data room controlado por Geocapitals"],
        ],
      },
      {
        kind: "paragraph",
        text: "El Proyecto TRENTO presenta una firma geoquímica LREE-dominante consistente con mineralogía de monacita y/o bastnasita, los dos minerales madre económicos de las tierras raras livianas. La presente ficha resume el caso comercial para la producción de un concentrado 30-60% TREO destinado a refinerías internacionales, con ruta metalúrgica gravimétrica + magnética + flotación validada por peers (Mountain Pass, Mount Weld, Bayan Obo).",
      },
      {
        kind: "table",
        head: ["Elemento", "Símbolo", "Ley top (ppm)", "% ΣREE canasta"],
        rows: [
          ["Cerio", "Ce", "≈ 1.020", "≈ 47%"],
          ["Lantano", "La", "≈ 520", "≈ 24%"],
          ["Neodimio", "Nd", "≈ 340", "≈ 16%"],
          ["Praseodimio", "Pr", "≈ 95", "≈ 4%"],
          ["Samario + Eu + Gd", "Sm/Eu/Gd", "≈ 60", "≈ 3%"],
          ["HREE (Dy, Tb, Y, resto)", "HREE", "≈ 120", "≈ 6%"],
        ],
      },
      {
        kind: "table",
        head: ["Escenario", "Concentrado", "Precio canasta", "Valor USD/t roca"],
        rows: [
          ["Base — ley cabeza 0,21% TREO", "in-situ", "USD 8-12/kg TREO", "USD 16-24"],
          ["Upgrade gravimétrico 30% TREO", "30% TREO", "USD 8-12/kg TREO", "USD 2.400-3.600 /t conc."],
          ["Upgrade flotación 60% TREO", "60% TREO", "USD 8-12/kg TREO", "USD 4.800-7.200 /t conc."],
          ["Referencia peers", "Mountain Pass 7%", "—", "Standalone REE viable"],
        ],
      },
      {
        kind: "clauses",
        items: [
          "1. Encaje mineralógico. La firma Ce+La+Nd+Pr > 90% ΣREE y LREE/HREE ≈ 9,46 es diagnóstica de monacita y/o bastnasita. Xenotima (HREE) queda descartada por el orden geoquímico observado.",
          "2. Ruta metalúrgica. (a) Chancado y molienda a p80 objetivo. (b) Concentración gravimétrica (mesas Wilfley / espirales). (c) Separación magnética para monacita paramagnética. (d) Flotación con colectores de ácido graso para bastnasita. Concentrado final 30-60% TREO exportable.",
          "3. Plan de confirmación 60-90 días. (i) QEMSCAN/XRD para cuantificar monacita vs bastnasita vs apatito/allanita. (ii) Análisis Th/U — define ruta metalúrgica y permisos de radiactivos. (iii) Ensayos de liberación y flowsheet piloto. (iv) Levantamiento topográfico y muestreo sistemático para modelo de bloques y estimación in-situ TREO.",
          "4. Compradores objetivo. Refinerías LREE en China, Malasia (Lynas), Europa (Solvay) y USA (MP Materials). Off-take típico: concentrado 30-60% TREO, contratos anuales indexados a canasta LREE (Ce/La/Nd/Pr).",
          "5. Estructura comercial. (a) Off-take + prepago, (b) JV con operador metalúrgico, o (c) venta directa del activo. Ticket referencial condicionado a completar el plan de confirmación y modelo de recursos.",
        ],
      },
      {
        kind: "paragraph",
        text: "Esta ficha es parte del expediente TRENTO bajo NDA y no constituye oferta pública ni recomendación de inversión. Toda información técnica se libera únicamente en el data room controlado por Geocapitals una vez firmado el acuerdo de confidencialidad.",
      },
    ],
  };
}

// ─────────────────────────── API pública ──────────────────────────────────

export type SpecialDocId =
  | "gold-nda"
  | "gold-ficha"
  | "trento-adenda"
  | "trento-mona-bast";

export const SPECIAL_DOCS: Array<{
  id: SpecialDocId;
  label: string;
  acronym: string;
  summary: string;
  build: () => GeneratedDoc;
}> = [
  {
    id: "gold-nda",
    label: "NDA · Proyecto Aurífero 4 Moz",
    acronym: "NDA",
    summary:
      "Confidencialidad mutua para due diligence del proyecto aurífero NI 43-101 (4,0 Moz Au · USD 900 M).",
    build: buildGoldNda,
  },
  {
    id: "gold-ficha",
    label: "Ficha · Proyecto Aurífero 4 Moz",
    acronym: "FICHA",
    summary:
      "Resumen ejecutivo con reservas, valoración comparativa y plan de acceso al data room.",
    build: buildGoldFicha,
  },
  {
    id: "trento-adenda",
    label: "Adenda TRENTO · Monacita / Bastnasita",
    acronym: "ADENDA",
    summary:
      "Diagnóstico mineralógico REE, valoración indicativa y plan de confirmación 60-90 días.",
    build: buildTrentoAdenda,
  },
  {
    id: "trento-mona-bast",
    label: "Ficha TRENTO · Monacita / Bastnasita",
    acronym: "FICHA",
    summary:
      "Ficha comercial LREE — concentrado 30-60% TREO, ruta metalúrgica y compradores objetivo.",
    build: buildTrentoMonaBastFicha,
  },
];


export async function downloadSpecialDoc(id: SpecialDocId): Promise<void> {
  const entry = SPECIAL_DOCS.find((d) => d.id === id);
  if (!entry) throw new Error(`Documento no encontrado: ${id}`);
  await renderGeocapitalsPdf(entry.build());
}
