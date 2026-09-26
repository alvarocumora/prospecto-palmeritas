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
    title: "Acuerdo de Confidencialidad — Proyecto Aurífero (4.000.000 oz Au · NI 43-101)",
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
    title: "Adenda técnica — Proyecto TRENTO · Mineralogía objetivo: monacita / bastnasita",
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
          [
            "Bastnasita",
            "(Ce,La)CO₃F",
            "4,9",
            "Gravimétrica + flotación (colectores de ácido graso)",
          ],
          [
            "Xenotima (descartada)",
            "YPO₄",
            "4,4-5,1",
            "HREE-dominante — no coincide con firma TRENTO",
          ],
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
    title: "Ficha comercial — Proyecto TRENTO · Concentrado LREE (Monacita / Bastnasita)",
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
          [
            "Upgrade gravimétrico 30% TREO",
            "30% TREO",
            "USD 8-12/kg TREO",
            "USD 2.400-3.600 /t conc.",
          ],
          [
            "Upgrade flotación 60% TREO",
            "60% TREO",
            "USD 8-12/kg TREO",
            "USD 4.800-7.200 /t conc.",
          ],
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

// ───────────── NCNDA · SingularX + ZBALATAM (data room proyectos) ─────────

export function buildSingularxNcnda(): GeneratedDoc {
  return {
    docType: "NCNDA",
    reference: "GC-NCNDA-SGX-ZBA-202607-1",
    date: today(),
    title:
      "Non-Circumvention & Non-Disclosure Agreement (NCNDA) — Geocapitals · SingularX · ZBALA LATAM",
    blocks: [
      {
        kind: "fields",
        rows: [
          [
            "Parte A · Advisor / Operador",
            "Geocapitals SpA · info@geocapitals.com · +56 9 6218 4071",
          ],
          ["Parte B · Broker / Buy-side", "SingularX — Eduardo · eduardo@singularx.io"],
          [
            "Parte C · Broker / Buy-side",
            "ZBALA LATAM — Joaquín Belmar · joaquin.belmar@zbalatam.com",
          ],
          [
            "Objeto",
            "Ofertas de compra de concentrados (Cu, Au, Sb, REE) y compra/venta de minas en Chile",
          ],
          [
            "Alcance data room",
            "Proyectos de oro, cobre, antimonio y tierras raras coordinados por Geocapitals",
          ],
          ["Vigencia / Term", "24 meses desde la firma · No-elusión 12 meses adicionales"],
          ["Jurisdicción / Governing law", "República de Chile · CAM Santiago"],
        ],
      },
      {
        kind: "paragraph",
        text: 'Between Geocapitals SpA (Party A), SingularX (Party B) and ZBALA LATAM (Party C) — collectively "The Parties" — this Non-Circumvention Non-Disclosure Agreement (NCNDA) is executed to enable the exchange of technical, commercial and financial information regarding purchase offers of mineral concentrates and mining assets in Chile. — Entre Geocapitals SpA (Parte A), SingularX (Parte B) y ZBALA LATAM (Parte C) — en conjunto, "Las Partes" — se celebra el presente Acuerdo de No Elusión y No Divulgación (NCNDA) para permitir el intercambio de información técnica, comercial y financiera relativa a ofertas de compra de concentrados minerales y activos mineros en Chile.',
      },
      {
        kind: "clauses",
        items: [
          "1. Object / Objeto. Regulate the exchange of information regarding concentrate offers (Cu, Au, Sb, REE) and mining assets sourced or advised by Geocapitals, and coordinate buy-side inquiries from SingularX and ZBALA LATAM. — Regular el intercambio de información sobre ofertas de concentrados (Cu, Au, Sb, REE) y activos mineros originados o asesorados por Geocapitals, y coordinar las consultas de compra de SingularX y ZBALA LATAM.",
          "2. Confidential Information / Información confidencial. Includes — without limitation — data room contents, NI 43-101 reports, block models, reserves and resources, financials, titles, contracts, counterparties, prices and any material shared by any Party. — Incluye, sin limitación, el contenido del data room, informes NI 43-101, modelos de bloques, reservas y recursos, estados financieros, títulos, contratos, contrapartes, precios y cualquier material compartido por cualquiera de las Partes.",
          "3. Non-Circumvention / No-elusión. The Parties agree not to contact, negotiate or contract, directly or indirectly, with the sellers, buyers, financiers, titleholders or counterparties identified by another Party, during the term and for 12 additional months. — Las Partes se obligan a no contactar, negociar ni contratar, directa o indirectamente, con los vendedores, compradores, financistas, titulares o contrapartes identificados por otra Parte, durante la vigencia y por 12 meses adicionales.",
          "4. Authorized circle / Círculo autorizado. Each Party may share information with its advisors, financiers and technical team under identical confidentiality obligations, being liable for their acts. — Cada Parte podrá compartir la información con sus asesores, financistas y equipo técnico bajo idénticas obligaciones de confidencialidad, respondiendo por sus actos.",
          "5. Data room access / Acceso al data room. Geocapitals will grant access to joaquin.belmar@zbalatam.com and eduardo@singularx.io to the project data rooms upon execution of this NCNDA, with per-user traceability. — Geocapitals otorgará acceso a joaquin.belmar@zbalatam.com y eduardo@singularx.io a los data rooms de los proyectos una vez firmado este NCNDA, con trazabilidad por usuario.",
          "6. Third-Party Projects / Proyectos con terceros. Any project to be shared with third parties shall require prior written acceptance of the signatories and the execution of a separate NCNDA limited to that project. — Todo proyecto que se comparta con terceros requerirá aceptación previa y por escrito de los firmantes y la suscripción de un NCNDA independiente limitado a ese proyecto.",
          "7. Term / Vigencia. 24 months from execution; confidentiality survives with respect to information received during such period. — 24 meses desde la firma; la confidencialidad subsiste respecto de la información recibida durante dicho período.",
          "8. Penalty / Penalidad. Breach entitles the affected Party to a minimum indemnity of US$ 250,000, without prejudice to additional proven damages. — El incumplimiento faculta a la Parte afectada a exigir una indemnización mínima de US$ 250.000, sin perjuicio de los daños adicionales que se acrediten.",
          "9. Governing law & arbitration / Ley y arbitraje. Governed by the laws of Chile. Disputes shall be submitted to arbitration at the CAM of the Santiago Chamber of Commerce. — Se rige por las leyes de Chile. Las controversias se someterán al arbitraje del CAM de la Cámara de Comercio de Santiago.",
          "10. Electronic signature / Firma electrónica. The Parties accept electronic signature and the QR traceability issued by the Geocapitals platform as valid expression of consent. — Las Partes aceptan la firma electrónica y la trazabilidad QR emitida por la plataforma Geocapitals como expresión válida del consentimiento.",
        ],
      },
      {
        kind: "signature",
        parties: [
          "Por Geocapitals SpA",
          "Por SingularX — Eduardo",
          "Por ZBALA LATAM — Joaquín Belmar",
        ],
      },
    ],
  };
}

// ────────────── Ficha Antimonio en Breña triturada (Honduras · A&D) ──────

export function buildAntimonyBrenaFicha(): GeneratedDoc {
  // Tabla oficial de precios FOB por ley (Corporación Minera A&D S.A. — SCO 24/06/2026).
  const priceTable: string[][] = [
    ["35%", "US$ 5.616", "57%", "US$ 6.336"],
    ["36%", "US$ 5.649", "58%", "US$ 6.368"],
    ["37%", "US$ 5.683", "59%", "US$ 6.401"],
    ["38%", "US$ 5.717", "60%", "US$ 6.433"],
    ["39%", "US$ 5.750", "61%", "US$ 6.465"],
    ["40%", "US$ 5.784", "62%", "US$ 6.498"],
    ["41%", "US$ 5.816", "63%", "US$ 6.530"],
    ["42%", "US$ 5.849", "64%", "US$ 6.563"],
    ["43%", "US$ 5.881", "65%", "US$ 6.595"],
    ["44%", "US$ 5.914", "66%", "US$ 6.628"],
    ["45%", "US$ 5.946", "67%", "US$ 6.660"],
    ["46%", "US$ 5.979", "68%", "US$ 6.693"],
    ["47%", "US$ 6.011", "69%", "US$ 6.725"],
    ["48%", "US$ 6.044", "70%", "US$ 6.757"],
    ["49%", "US$ 6.076", "71%", "US$ 6.790"],
    ["50%", "US$ 6.108", "72%", "US$ 6.822"],
    ["51%", "US$ 6.141", "73%", "US$ 6.855"],
    ["52%", "US$ 6.173", "74%", "US$ 6.888"],
    ["53%", "US$ 6.206", "75%", "US$ 6.920"],
    ["54%", "US$ 6.238", "76%", "US$ 6.952"],
    ["55%", "US$ 6.271", "77%", "US$ 7.030"],
    ["56%", "US$ 6.303", "—", "—"],
  ];
  return {
    docType: "FICHA",
    reference: "GC-FICHA-SB-BRENA-202607-1",
    date: today(),
    title: "Ficha comercial — Antimonio en breña triturada (Sb 35–77% · Honduras · FOB)",
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Producto", "Antimonio en breña triturada (mineral sulfurado / óxido)"],
          ["Origen", "Honduras — Corporación Minera A&D S.A. de C.V. (concesiones vigentes)"],
          ["Advisor / Operador", "Geocapitals SpA · info@geocapitals.com · +56 9 6218 4071"],
          ["Granulometría", "1 pulgada a finos"],
          ["Ley Sb", "35% – 77% (rango contractual con escala de precio)"],
          ["Volumen disponible", "100 MT/mes o más (escalable)"],
          ["Periodo de contrato", "12 meses renovables"],
          ["Incoterm", "FOB puerto Honduras"],
          [
            "Puertos de embarque",
            "Puerto Cortés · Puerto Castilla (Atlántico) · San Lorenzo (Pacífico)",
          ],
          [
            "Pago",
            "SBLC 100% irrevocable, transferible y divisible · SWIFT MT103 contra inspección",
          ],
          ["Acceso", "Bajo NDA / NCNDA · Data room controlado por Geocapitals"],
        ],
      },
      {
        kind: "paragraph",
        text: 'Oferta corporativa suave (SCO) originada por Corporación Minera A&D S.A. (Honduras) y canalizada por Geocapitals como advisor de la operación. Producto: antimonio en breña triturada, granulometría 1" a finos, con escala de precio FOB en función de la ley Sb (35% a 77%). La operación se estructura para compradores directos con proof of funds y capacidad de emisión de SBLC 100% irrevocable, transferible y divisible, con pago en puerto de carga contra informes de inspección y documentos de embarque vía SWIFT MT103.',
      },
      {
        kind: "table",
        head: ["Ley Sb", "US$ / MT (FOB)", "Ley Sb", "US$ / MT (FOB)"],
        rows: priceTable,
      },
      {
        kind: "table",
        head: ["Elemento", "Símbolo", "Muestra 1", "Muestra 2"],
        rows: [
          ["Antimonio", "Sb %", "71,54", "47,90"],
          ["Plomo", "Pb %", "0,02", "0,03"],
          ["Bismuto", "Bi %", "0,00", "0,00"],
          ["Arsénico", "As %", "0,03", "0,04"],
          ["Zinc (muestra roja)", "Zn %", "43,32", "—"],
        ],
      },
      {
        kind: "clauses",
        items: [
          "1. Base de precio. Tabla FOB oficial 24/06/2026 en USD por tonelada métrica, con impuestos incluidos según origen. Ajuste proporcional automático ante variaciones de la referencia internacional (Rotterdam / MB Antimony).",
          "2. Calidad. Ensayos por absorción atómica de laboratorio independiente (Consuelo Montes Segura, San Luis Potosí). Muestras representativas confirman leyes Sb entre 47,9% y 71,5%, con impurezas Pb/Bi/As dentro de rangos comerciales estándar.",
          "3. Inspección y pago. Inspección SGS / Alfred H. Knight en puerto de carga. Liberación de SBLC contra Certificate of Analysis + Bill of Lading + Certificate of Origin (SWIFT MT103).",
          "4. Logística. Embarque FOB desde Puerto Cortés, Puerto Castilla (Atlántico) o San Lorenzo (Pacífico) según destino final. Empaque en super sacos (big bags) o granel según requerimiento del comprador.",
          "5. Bancos. Beneficiario final Corporación Minera A&D S.A. de C.V. · Banco beneficiario Banco FICOHSA (Honduras) · Banco intermediario Bank of America.",
          "6. Requisitos del comprador. Proof of Funds (POF) vigente, ICPO firmada, KYC completo y contrato marco (SPA) bajo términos aquí descritos. Geocapitals coordina onboarding, NCNDA tripartito y trazabilidad QR de todos los documentos.",
          "7. Confidencialidad. La presente ficha se libera únicamente bajo NDA/NCNDA vigente. Toda información técnica adicional (planos de concesión, muestras adicionales, capacidad instalada) se comparte en el data room controlado por Geocapitals.",
        ],
      },
      {
        kind: "fields",
        rows: [
          [
            "Representante legal (origen)",
            "Delmer Francisco Munguía Pagoada — Corporación Minera A&D S.A.",
          ],
          ["Gerente general (origen)", "César González Díaz — Corporación Minera A&D S.A."],
          ["Advisor comercial", "Geocapitals SpA — info@geocapitals.com · +56 9 6218 4071"],
          ["Fecha SCO base", "24 de junio de 2026"],
        ],
      },
      {
        kind: "paragraph",
        text: "Esta ficha no constituye oferta pública ni recomendación de inversión. La transacción se materializa mediante NCNDA tripartito, ICPO, SPA y protocolos SBLC/SWIFT MT103 estándar. Geocapitals actúa como advisor de la operación y coordina la comunicación entre el titular hondureño y el comprador final.",
      },
    ],
  };
}

// ─────────────────────────── API pública ──────────────────────────────────

export type SpecialDocId =
  | "gold-nda"
  | "gold-ficha"
  | "trento-adenda"
  | "trento-mona-bast"
  | "singularx-ncnda"
  | "antimony-brena";

export type SpecialDocSigner = { role: string; name?: string; email?: string };

export const SPECIAL_DOCS: Array<{
  id: SpecialDocId;
  label: string;
  acronym: string;
  summary: string;
  build: () => GeneratedDoc;
  /** Firmantes sugeridos para el flujo de firma electrónica. */
  signers: SpecialDocSigner[];
}> = [
  {
    id: "gold-nda",
    label: "NDA · Proyecto Aurífero 4 Moz",
    acronym: "NDA",
    summary:
      "Confidencialidad mutua para due diligence del proyecto aurífero NI 43-101 (4,0 Moz Au · USD 900 M).",
    build: buildGoldNda,
    signers: [{ role: "Por Geocapitals SpA" }, { role: "Por el Receptor" }],
  },
  {
    id: "gold-ficha",
    label: "Ficha · Proyecto Aurífero 4 Moz",
    acronym: "FICHA",
    summary:
      "Resumen ejecutivo con reservas, valoración comparativa y plan de acceso al data room.",
    build: buildGoldFicha,
    signers: [{ role: "Acuse de recibo" }],
  },
  {
    id: "trento-adenda",
    label: "Adenda TRENTO · Monacita / Bastnasita",
    acronym: "ADENDA",
    summary:
      "Diagnóstico mineralógico REE, valoración indicativa y plan de confirmación 60-90 días.",
    build: buildTrentoAdenda,
    signers: [{ role: "Acuse de recibo" }],
  },
  {
    id: "trento-mona-bast",
    label: "Ficha TRENTO · Monacita / Bastnasita",
    acronym: "FICHA",
    summary:
      "Ficha comercial LREE — concentrado 30-60% TREO, ruta metalúrgica y compradores objetivo.",
    build: buildTrentoMonaBastFicha,
    signers: [{ role: "Acuse de recibo" }],
  },
  {
    id: "singularx-ncnda",
    label: "NCNDA · SingularX + ZBALA LATAM",
    acronym: "NCNDA",
    summary:
      "Tripartito ICC bilingüe (ES/EN) para habilitar accesos al data room de proyectos y ofertas de compra.",
    build: buildSingularxNcnda,
    signers: [
      { role: "Por Geocapitals SpA", email: "info@geocapitals.com" },
      { role: "Por SingularX", name: "Eduardo", email: "eduardo@singularx.io" },
      { role: "Por ZBALA LATAM", name: "Joaquín Belmar", email: "joaquin.belmar@zbalatam.com" },
    ],
  },
  {
    id: "antimony-brena",
    label: "Ficha · Antimonio en breña triturada (Honduras)",
    acronym: "FICHA",
    summary:
      "SCO Corporación Minera A&D — Sb 35–77%, tabla FOB oficial, ensayos AA y protocolo SBLC/SWIFT MT103.",
    build: buildAntimonyBrenaFicha,
    signers: [{ role: "Acuse de recibo" }],
  },
];

export async function downloadSpecialDoc(id: SpecialDocId): Promise<void> {
  const entry = SPECIAL_DOCS.find((d) => d.id === id);
  if (!entry) throw new Error(`Documento no encontrado: ${id}`);
  await renderGeocapitalsPdf(entry.build());
}
