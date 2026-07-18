// Catálogo de plantillas editables de Geocapitals: NDA, NDI, MoU, LOI, Term
// Sheet, SPA (esqueleto), JV, Royalty/NSR y Advisory. Lógica pura; el editor
// y el renderer PDF consumen estas definiciones.

import type { TemplateDef, GeneratedDoc, DocBlock } from "./model";
import { OWN_PARTY_LINE } from "./company";

const gv = (values: Record<string, string>, key: string, fallback = ""): string =>
  values[key]?.trim() || fallback;

function bracket(x: string, ph: string): string {
  return x || `[${ph}]`;
}

function jurisdictionClause(jur: string): string {
  return `El presente instrumento se rige por las leyes de ${jur || "[jurisdicción]"} y las controversias serán sometidas al arbitraje del Centro de Arbitraje y Mediación (CAM) de la Cámara de Comercio de Santiago, salvo pacto en contrario por escrito.`;
}

/**
 * Renumera cláusulas para evitar saltos cuando alguna se omite por toggle.
 * Elimina cualquier prefijo "N. " o "N) " existente y asigna un contador
 * secuencial 1..n conservando el resto del texto.
 */
function renumber(items: string[]): string[] {
  return items.map((item, i) => {
    const stripped = item.replace(/^\s*\d+[.)]\s*/, "");
    return `${i + 1}. ${stripped}`;
  });
}

/* ─────────────── NDA ─────────────── */
const nda: TemplateDef = {
  id: "nda",
  title: "Acuerdo de Confidencialidad (NDA)",
  shortTitle: "NDA",
  acronym: "NDA",
  category: "legal",
  summary:
    "Acuerdo mutuo o unilateral para proteger información confidencial en negociaciones de proyectos mineros o inversión.",
  fields: [
    {
      key: "mode",
      label: "Modalidad",
      type: "select",
      default: "mutuo",
      options: [
        { value: "mutuo", label: "Mutuo (ambas partes divulgan)" },
        { value: "unilateral", label: "Unilateral (solo A divulga)" },
      ],
    },
    {
      key: "partyA",
      label: "Parte A (Divulgante)",
      default: OWN_PARTY_LINE,
      type: "text",
      placeholder: "Razón social + tax id",
    },
    {
      key: "partyB",
      label: "Parte B (Receptor)",
      type: "text",
      placeholder: "Razón social + tax id",
    },
    {
      key: "purpose",
      label: "Propósito de la divulgación",
      type: "textarea",
      placeholder: "Ej.: evaluación de una potencial inversión en el proyecto minero X.",
    },
    { key: "termMonths", label: "Vigencia (meses)", type: "number", default: "24" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "nonCircumvention",
      label: "No elusión (non-circumvention)",
      defaultOn: false,
      text: "Las Partes se obligan a no contactar, negociar ni contratar directa o indirectamente con las contrapartes, fuentes, financistas o clientes identificados por la otra Parte durante la vigencia de este acuerdo y por doce (12) meses adicionales.",
    },
    {
      key: "penalty",
      label: "Penalidad convencional por incumplimiento",
      defaultOn: false,
      text: "El incumplimiento de las obligaciones de confidencialidad dará derecho a la Parte afectada a exigir una indemnización mínima equivalente a US$ 250.000, sin perjuicio de los daños adicionales que pueda probar.",
    },
    {
      key: "returnInfo",
      label: "Devolución/destrucción de información",
      defaultOn: true,
      text: "Al término del propósito, o a requerimiento de la Divulgante, la Receptora devolverá o destruirá toda la información confidencial y certificará por escrito dicha destrucción.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const mode = gv(val, "mode", "mutuo");
    const A = bracket(gv(val, "partyA"), "Parte A");
    const B = bracket(gv(val, "partyB"), "Parte B");
    const purpose = gv(val, "purpose", "la evaluación de una potencial oportunidad de negocio");
    const term = gv(val, "termMonths", "24");
    const jur = gv(val, "jurisdiction", "República de Chile");
    const raw: Array<[string, string]> = [
      ["OBJETO", `El presente acuerdo regula el intercambio de información confidencial entre las Partes con el fin de ${purpose}.`],
      ["INFORMACIÓN CONFIDENCIAL", `Se considera confidencial toda información técnica, geológica, financiera, comercial o legal entregada por ${mode === "mutuo" ? "cualquiera de las Partes" : `${A}`} en cualquier formato.`],
      ["USO", `La información será utilizada exclusivamente para el propósito indicado y no podrá divulgarse a terceros sin autorización previa y por escrito.`],
      ["VIGENCIA", `Las obligaciones de este acuerdo tendrán una duración de ${term} meses contados desde su firma.`],
    ];
    if (active.has("nonCircumvention")) raw.push(["NO ELUSIÓN", nda.clauses.find((c) => c.key === "nonCircumvention")!.text]);
    if (active.has("returnInfo")) raw.push(["DEVOLUCIÓN", nda.clauses.find((c) => c.key === "returnInfo")!.text]);
    if (active.has("penalty")) raw.push(["PENALIDAD", nda.clauses.find((c) => c.key === "penalty")!.text]);
    raw.push(["LEY APLICABLE Y ARBITRAJE", jurisdictionClause(jur)]);
    const clauseItems: string[] = raw.map(([label, txt], i) => `${i + 1}. ${label}. ${txt}`);

    return {
      docType: "nda",
      reference: ctx.reference,
      date: ctx.date,
      title:
        mode === "mutuo"
          ? "ACUERDO DE CONFIDENCIALIDAD MUTUO (MUTUAL NDA)"
          : "ACUERDO DE CONFIDENCIALIDAD (NDA)",
      blocks: [
        {
          kind: "paragraph",
          text: `Entre ${A} y ${B} (las "Partes"), en la fecha indicada al final, se celebra el presente Acuerdo de Confidencialidad en los términos siguientes.`,
        },
        {
          kind: "fields",
          rows: [
            ["Divulgante", A],
            ["Receptor", B],
            ["Modalidad", mode === "mutuo" ? "Mutuo" : "Unilateral"],
            ["Propósito", purpose],
            ["Vigencia", `${term} meses`],
            ["Jurisdicción", jur],
          ],
        },
        { kind: "clauses", items: clauseItems },
        { kind: "signature", parties: [A, B] },
      ],
    };
  },
};

/* ─────────────── NDI (Non-Disclosure + Non-Circumvention) ─────────────── */
const ndi: TemplateDef = {
  id: "ndi",
  title: "NDA + No Elusión (NCNDA / NDI)",
  shortTitle: "NCNDA",
  acronym: "NCNDA",
  category: "legal",
  summary:
    "Acuerdo típico de brokerage/trade que combina confidencialidad y prohibición de elusionar a la contraparte en operaciones de commodities.",
  fields: [
    {
      key: "partyA",
      label: "Parte A",
      type: "text",
      placeholder: "Razón social + tax id",
      default: OWN_PARTY_LINE,
    },
    { key: "partyB", label: "Parte B", type: "text", placeholder: "Razón social + tax id" },
    {
      key: "commodity",
      label: "Producto / operación",
      type: "text",
      placeholder: "Ej.: concentrado de cobre 25% Cu",
    },
    { key: "termMonths", label: "Vigencia (meses)", type: "number", default: "36" },
    { key: "commissionPct", label: "Comisión pactada (%)", type: "number", default: "2" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "iccBased",
      label: "Referencia a marco ICC (Cámara de Comercio Internacional)",
      defaultOn: true,
      text: "Las Partes reconocen que este acuerdo se inspira en las guías ICC 619 y ICC 500/600 en lo aplicable a la protección de intermediarios y cadenas de suministro internacionales.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const A = bracket(gv(val, "partyA"), "Parte A");
    const B = bracket(gv(val, "partyB"), "Parte B");
    const commodity = gv(val, "commodity", "[producto/operación]");
    const term = gv(val, "termMonths", "36");
    const pct = gv(val, "commissionPct", "2");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "ndi",
      reference: ctx.reference,
      date: ctx.date,
      title: "NON-CIRCUMVENTION & NON-DISCLOSURE AGREEMENT (NCNDA)",
      blocks: [
        {
          kind: "paragraph",
          text: `Entre ${A} y ${B} (las "Partes") se celebra el presente NCNDA con relación a la operación de ${commodity}.`,
        },
        {
          kind: "fields",
          rows: [
            ["Parte A", A],
            ["Parte B", B],
            ["Operación", commodity],
            ["Vigencia", `${term} meses`],
            ["Comisión pactada", `${pct}%`],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. CONFIDENCIALIDAD. Toda información técnica, comercial, financiera y de contactos intercambiada será tratada como estrictamente confidencial.`,
            `2. NO ELUSIÓN. Ninguna de las Partes podrá contactar, negociar ni contratar directa o indirectamente con las contrapartes, productores, compradores, financistas o brokers presentados por la otra, sin su consentimiento previo por escrito.`,
            `3. COMISIÓN. Cualquier operación derivada de las presentaciones efectuadas conlleva el reconocimiento de una comisión de ${pct}% del valor bruto de la transacción, pagadera al cierre de cada embarque o disbursement.`,
            `4. VIGENCIA. ${term} meses desde la firma, extensible por operaciones recurrentes.`,
            ...(active.has("iccBased") ? [`5. MARCO INTERNACIONAL. ${ndi.clauses[0].text}`] : []),
            `6. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [A, B] },
      ],
    };
  },
};

/* ─────────────── MoU ─────────────── */
const mou: TemplateDef = {
  id: "mou",
  title: "Memorando de Entendimiento (MoU)",
  shortTitle: "MoU",
  acronym: "MoU",
  category: "inversion",
  summary:
    "Marco no vinculante entre partes que exploran una potencial transacción o alianza estratégica.",
  fields: [
    { key: "partyA", label: "Parte A", type: "text", default: OWN_PARTY_LINE },
    { key: "partyB", label: "Parte B", type: "text" },
    { key: "project", label: "Proyecto / oportunidad", type: "text" },
    { key: "objective", label: "Objetivo del entendimiento", type: "textarea" },
    { key: "exclusivityDays", label: "Exclusividad (días)", type: "number", default: "60" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "exclusivity",
      label: "Exclusividad negociadora",
      defaultOn: true,
      text: "Durante la exclusividad indicada, las Partes se abstendrán de negociar la misma operación con terceros.",
    },
    {
      key: "costs",
      label: "Cada parte asume sus costos",
      defaultOn: true,
      text: "Cada Parte asumirá sus propios costos y honorarios asociados a la due diligence y estructuración.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const A = bracket(gv(val, "partyA"), "Parte A");
    const B = bracket(gv(val, "partyB"), "Parte B");
    const project = gv(val, "project", "[proyecto]");
    const obj = gv(val, "objective", "explorar una potencial transacción o alianza");
    const excl = gv(val, "exclusivityDays", "60");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "mou",
      reference: ctx.reference,
      date: ctx.date,
      title: "MEMORANDO DE ENTENDIMIENTO (MoU)",
      blocks: [
        {
          kind: "paragraph",
          text: `${A} y ${B} suscriben el presente MoU con relación a ${project}, con el objetivo de ${obj}. Este documento refleja la intención de las Partes y no genera obligaciones vinculantes, salvo las cláusulas expresamente identificadas como tales (confidencialidad, exclusividad y costos).`,
        },
        {
          kind: "fields",
          rows: [
            ["Parte A", A],
            ["Parte B", B],
            ["Proyecto", project],
            ["Exclusividad", `${excl} días`],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. OBJETO. ${obj}.`,
            `2. HITOS. Las Partes acuerdan avanzar en due diligence técnica, legal y financiera dentro de la ventana de exclusividad.`,
            ...(active.has("exclusivity")
              ? [
                  `3. EXCLUSIVIDAD. ${mou.clauses.find((c) => c.key === "exclusivity")!.text} Vigencia: ${excl} días.`,
                ]
              : []),
            ...(active.has("costs")
              ? [`4. COSTOS. ${mou.clauses.find((c) => c.key === "costs")!.text}`]
              : []),
            `5. CONFIDENCIALIDAD. Sujeta a un NDA separado o al presente entendimiento como cláusula vinculante.`,
            `6. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [A, B] },
      ],
    };
  },
};

/* ─────────────── LOI ─────────────── */
const loi: TemplateDef = {
  id: "loi",
  title: "Carta de Intención (LOI)",
  shortTitle: "LOI",
  acronym: "LOI",
  category: "inversion",
  summary: "Manifestación de interés preliminar del inversionista o comprador sobre una operación.",
  fields: [
    { key: "buyer", label: "Inversionista / Comprador", type: "text", default: OWN_PARTY_LINE },
    { key: "seller", label: "Titular / Vendedor", type: "text" },
    { key: "project", label: "Proyecto", type: "text" },
    { key: "amount", label: "Monto indicativo (USD)", type: "text", placeholder: "5,000,000" },
    {
      key: "structure",
      label: "Estructura (equity / earn-in / royalty)",
      type: "text",
      default: "earn-in",
    },
    { key: "validityDays", label: "Validez (días)", type: "number", default: "45" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => {
    const B = bracket(gv(val, "buyer"), "Comprador");
    const S = bracket(gv(val, "seller"), "Vendedor");
    const project = gv(val, "project", "[proyecto]");
    const amount = gv(val, "amount", "[monto]");
    const structure = gv(val, "structure", "earn-in");
    const validity = gv(val, "validityDays", "45");
    return {
      docType: "loi",
      reference: ctx.reference,
      date: ctx.date,
      title: "CARTA DE INTENCIÓN (LOI)",
      blocks: [
        {
          kind: "paragraph",
          text: `${B} (el "Interesado") manifiesta a ${S} (el "Titular") su interés preliminar y no vinculante en concretar una operación sobre ${project} bajo la estructura de ${structure}.`,
        },
        {
          kind: "fields",
          rows: [
            ["Interesado", B],
            ["Titular", S],
            ["Proyecto", project],
            ["Monto indicativo", `USD ${amount}`],
            ["Estructura", structure],
            ["Validez", `${validity} días`],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. Esta carta no constituye obligación vinculante de compra, inversión o venta, y queda sujeta a: (a) due diligence satisfactoria, (b) firma de contratos definitivos, y (c) aprobaciones societarias y regulatorias aplicables.`,
            `2. Las Partes iniciarán de buena fe la due diligence y estructuración del negocio dentro de la validez indicada.`,
            `3. La confidencialidad se rige por el NDA suscrito o, en su defecto, por las prácticas usuales en operaciones de similar naturaleza.`,
          ]),
        },
        { kind: "signature", parties: [B] },
      ],
    };
  },
};

/* ─────────────── Term Sheet ─────────────── */
const termSheet: TemplateDef = {
  id: "term-sheet",
  title: "Term Sheet de Inversión / Earn-in",
  shortTitle: "Term Sheet",
  category: "inversion",
  summary:
    "Resumen de términos económicos y de gobierno para una inversión minera o venture: equity, earn-in, royalty y hitos.",
  fields: [
    { key: "investor", label: "Inversionista", type: "text", default: OWN_PARTY_LINE },
    { key: "company", label: "Compañía / SPV", type: "text" },
    { key: "project", label: "Proyecto", type: "text" },
    { key: "amount", label: "Monto (USD)", type: "text" },
    { key: "stake", label: "Participación resultante (%)", type: "text", default: "51" },
    {
      key: "structure",
      label: "Estructura",
      type: "select",
      default: "earn-in",
      options: [
        { value: "equity", label: "Equity directo" },
        { value: "earn-in", label: "Earn-in por etapas" },
        { value: "convertible", label: "Convertible / SAFE" },
        { value: "royalty", label: "Royalty NSR" },
      ],
    },
    {
      key: "milestones",
      label: "Hitos / uso de fondos",
      type: "textarea",
      placeholder: "1) Estudio conceptual; 2) 5,000 m de sondaje; 3) NI 43-101 inferido...",
    },
    { key: "valuation", label: "Valorización pre-money (USD)", type: "text" },
    {
      key: "governance",
      label: "Gobierno (asientos, vetos)",
      type: "textarea",
      default:
        "2 asientos de 5 en el directorio; derechos de veto sobre capex mayor a US$ 1M, endeudamiento y cambios de control.",
    },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "tagAlong",
      label: "Tag-along / Drag-along",
      defaultOn: true,
      text: "El inversionista tendrá derechos de tag-along en ventas de control y derechos de drag-along a partir de una participación agregada del 66%.",
    },
    {
      key: "antiDilution",
      label: "Antidilución (broad-based weighted average)",
      defaultOn: true,
      text: "Protección antidilución bajo la fórmula broad-based weighted average para rondas posteriores a menor valorización.",
    },
    {
      key: "roFR",
      label: "Right of first refusal",
      defaultOn: true,
      text: "El inversionista tendrá derecho de primera opción en cualquier venta de acciones por parte de los fundadores.",
    },
    {
      key: "esg",
      label: "Compromisos ESG y NI 43-101",
      defaultOn: true,
      text: "La compañía se compromete a mantener estándares ESG y a reportar recursos y reservas conforme a NI 43-101 o JORC.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const inv = bracket(gv(val, "investor"), "Inversionista");
    const co = bracket(gv(val, "company"), "Compañía");
    const project = gv(val, "project", "[proyecto]");
    const amount = gv(val, "amount", "[monto]");
    const stake = gv(val, "stake", "[%]");
    const structure = gv(val, "structure", "earn-in");
    const milestones = gv(val, "milestones", "Hitos por definir en el contrato definitivo.");
    const valuation = gv(val, "valuation", "[valorización]");
    const gov = gv(val, "governance");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "term-sheet",
      reference: ctx.reference,
      date: ctx.date,
      title: "TERM SHEET DE INVERSIÓN",
      blocks: [
        {
          kind: "paragraph",
          text: `Resumen no vinculante (excepto confidencialidad, exclusividad y costos) de los términos propuestos por ${inv} para invertir en ${co} respecto del proyecto ${project}.`,
        },
        {
          kind: "table",
          head: ["Concepto", "Términos propuestos"],
          rows: [
            ["Inversionista", inv],
            ["Compañía / SPV", co],
            ["Proyecto", project],
            ["Estructura", structure],
            ["Monto", `USD ${amount}`],
            ["Participación resultante", `${stake}%`],
            ["Valorización pre-money", `USD ${valuation}`],
            ["Uso de fondos / hitos", milestones],
            ["Gobierno corporativo", gov || "A definir en SHA."],
            ["Ley aplicable", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. CIERRE. Sujeto a due diligence satisfactoria, firma de SPA/SSA y SHA, y aprobaciones regulatorias.`,
            ...(active.has("tagAlong")
              ? [`2. LIQUIDEZ. ${termSheet.clauses.find((c) => c.key === "tagAlong")!.text}`]
              : []),
            ...(active.has("antiDilution")
              ? [
                  `3. ANTIDILUCIÓN. ${termSheet.clauses.find((c) => c.key === "antiDilution")!.text}`,
                ]
              : []),
            ...(active.has("roFR")
              ? [`4. ROFR. ${termSheet.clauses.find((c) => c.key === "roFR")!.text}`]
              : []),
            ...(active.has("esg")
              ? [`5. ESG Y REPORTING. ${termSheet.clauses.find((c) => c.key === "esg")!.text}`]
              : []),
            `6. EXCLUSIVIDAD. 60 días de exclusividad negociadora, vinculantes.`,
            `7. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [inv, co] },
      ],
    };
  },
};

/* ─────────────── SPA (esqueleto) ─────────────── */
const spa: TemplateDef = {
  id: "spa",
  title: "Share Purchase Agreement (esqueleto)",
  shortTitle: "SPA",
  acronym: "SPA",
  category: "inversion",
  summary:
    "Esqueleto de contrato de compraventa de acciones para operaciones M&A minero. Requiere revisión legal.",
  fields: [
    { key: "buyer", label: "Comprador", type: "text", default: OWN_PARTY_LINE },
    { key: "seller", label: "Vendedor", type: "text" },
    { key: "target", label: "Sociedad objetivo", type: "text" },
    { key: "shares", label: "Acciones / porcentaje", type: "text", default: "100%" },
    { key: "price", label: "Precio (USD)", type: "text" },
    { key: "closingDate", label: "Fecha de cierre", type: "date" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "escrow",
      label: "Retención en escrow (10% por 12 meses)",
      defaultOn: true,
      text: "Un 10% del precio quedará en escrow por 12 meses como garantía de las declaraciones y garantías del Vendedor.",
    },
    {
      key: "earnout",
      label: "Earn-out por hitos de recursos",
      defaultOn: false,
      text: "Pago adicional por hitos: (a) recursos inferidos NI 43-101; (b) inicio de producción; (c) primera exportación.",
    },
    {
      key: "nonCompete",
      label: "No competencia del Vendedor (24 meses)",
      defaultOn: true,
      text: "El Vendedor se obliga a no competir en el radio de 25 km del proyecto por 24 meses.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const B = bracket(gv(val, "buyer"), "Comprador");
    const S = bracket(gv(val, "seller"), "Vendedor");
    const target = bracket(gv(val, "target"), "Sociedad Objetivo");
    const shares = gv(val, "shares", "100%");
    const price = gv(val, "price", "[precio]");
    const closing = gv(val, "closingDate", "[fecha de cierre]");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "spa",
      reference: ctx.reference,
      date: ctx.date,
      title: "SHARE PURCHASE AGREEMENT (SPA)",
      blocks: [
        {
          kind: "paragraph",
          text: `Contrato de compraventa de acciones celebrado entre ${S} (el "Vendedor") y ${B} (el "Comprador") sobre ${shares} de las acciones de ${target} (la "Sociedad Objetivo").`,
        },
        {
          kind: "fields",
          rows: [
            ["Comprador", B],
            ["Vendedor", S],
            ["Sociedad Objetivo", target],
            ["Acciones", shares],
            ["Precio", `USD ${price}`],
            ["Fecha de cierre", closing],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. OBJETO. El Vendedor vende y el Comprador compra ${shares} de las acciones de la Sociedad Objetivo.`,
            `2. PRECIO Y PAGO. Precio: USD ${price}. Se pagará al cierre mediante transferencia electrónica a la cuenta que el Vendedor indique.`,
            `3. CONDICIONES SUSPENSIVAS. (a) Aprobaciones regulatorias; (b) DD satisfactoria; (c) sin cambios adversos relevantes (MAC).`,
            `4. DECLARACIONES Y GARANTÍAS. Titularidad de acciones, cumplimiento regulatorio y ambiental, veracidad de estados financieros y de reservas/recursos declarados.`,
            `5. INDEMNIZACIONES. Sujetas a de minimis, basket y cap conforme a las prácticas de mercado.`,
            ...(active.has("escrow")
              ? [`6. ESCROW. ${spa.clauses.find((c) => c.key === "escrow")!.text}`]
              : []),
            ...(active.has("earnout")
              ? [`7. EARN-OUT. ${spa.clauses.find((c) => c.key === "earnout")!.text}`]
              : []),
            ...(active.has("nonCompete")
              ? [`8. NO COMPETENCIA. ${spa.clauses.find((c) => c.key === "nonCompete")!.text}`]
              : []),
            `9. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [S, B] },
      ],
    };
  },
};

/* ─────────────── JV ─────────────── */
const jv: TemplateDef = {
  id: "jv",
  title: "Joint Venture Agreement (esqueleto)",
  shortTitle: "JV",
  category: "inversion",
  summary:
    "Marco de joint venture minero para desarrollo conjunto: aportes, participación, dilución y control operacional.",
  fields: [
    { key: "partyA", label: "Socio A (operador)", type: "text", default: OWN_PARTY_LINE },
    { key: "partyB", label: "Socio B (financista)", type: "text" },
    { key: "project", label: "Proyecto", type: "text" },
    {
      key: "contributionA",
      label: "Aporte Socio A",
      type: "textarea",
      placeholder: "Concesiones, know-how, licencias...",
    },
    { key: "contributionB", label: "Aporte Socio B (USD)", type: "text" },
    { key: "stakeA", label: "Participación inicial A (%)", type: "text", default: "50" },
    { key: "stakeB", label: "Participación inicial B (%)", type: "text", default: "50" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "dilution",
      label: "Dilución de socio no aportante",
      defaultOn: true,
      text: "El socio que no concurra a cash-calls se diluirá conforme a fórmula straight-line pro rata; al caer bajo 10% su participación se convierte en NSR 2%.",
    },
    {
      key: "operator",
      label: "Nombramiento de operador",
      defaultOn: true,
      text: "El Socio A actuará como operador con reporting mensual al comité técnico. Podrá ser removido por decisiones erróneas graves acreditadas.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const A = bracket(gv(val, "partyA"), "Socio A");
    const B = bracket(gv(val, "partyB"), "Socio B");
    const project = gv(val, "project", "[proyecto]");
    const cA = gv(val, "contributionA", "aportes técnicos y concesiones");
    const cB = gv(val, "contributionB", "[monto]");
    const sA = gv(val, "stakeA", "50");
    const sB = gv(val, "stakeB", "50");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "jv",
      reference: ctx.reference,
      date: ctx.date,
      title: "JOINT VENTURE AGREEMENT",
      blocks: [
        {
          kind: "paragraph",
          text: `${A} y ${B} constituyen una joint venture para el desarrollo del proyecto ${project}.`,
        },
        {
          kind: "table",
          head: ["Concepto", "Socio A", "Socio B"],
          rows: [
            ["Rol", "Operador técnico", "Financista"],
            ["Aporte", cA, `USD ${cB}`],
            ["Participación inicial", `${sA}%`, `${sB}%`],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. OBJETO. Explorar, desarrollar y explotar el proyecto ${project}.`,
            `2. GOBIERNO. Comité técnico paritario; decisiones mayoritarias salvo materias reservadas (endeudamiento, cambio de operador, dividendos).`,
            `3. CASH-CALLS. Aportes proporcionales a la participación vigente.`,
            ...(active.has("dilution")
              ? [`4. DILUCIÓN. ${jv.clauses.find((c) => c.key === "dilution")!.text}`]
              : []),
            ...(active.has("operator")
              ? [`5. OPERADOR. ${jv.clauses.find((c) => c.key === "operator")!.text}`]
              : []),
            `6. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [A, B] },
      ],
    };
  },
};

/* ─────────────── Royalty NSR ─────────────── */
const royalty: TemplateDef = {
  id: "royalty",
  title: "Royalty Agreement (NSR)",
  shortTitle: "Royalty NSR",
  acronym: "NSR",
  category: "inversion",
  summary:
    "Contrato de regalía tipo Net Smelter Return sobre la producción de una concesión minera.",
  fields: [
    {
      key: "grantor",
      label: "Otorgante (titular de la concesión)",
      type: "text",
      default: OWN_PARTY_LINE,
    },
    { key: "beneficiary", label: "Beneficiario del royalty", type: "text" },
    { key: "concession", label: "Concesión / proyecto", type: "text" },
    { key: "rate", label: "Tasa NSR (%)", type: "number", default: "2" },
    {
      key: "buyback",
      label: "Opción de recompra (USD por 0.5%)",
      type: "text",
      placeholder: "1,000,000",
    },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "audit",
      label: "Auditoría anual del beneficiario",
      defaultOn: true,
      text: "El Beneficiario podrá auditar los libros del Otorgante una vez al año, con costo a su cargo salvo desvíos mayores al 3%.",
    },
    {
      key: "advance",
      label: "Anticipos trimestrales",
      defaultOn: false,
      text: "El Otorgante pagará anticipos trimestrales estimados, con reliquidación anual.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const G = bracket(gv(val, "grantor"), "Otorgante");
    const Bf = bracket(gv(val, "beneficiary"), "Beneficiario");
    const conc = gv(val, "concession", "[concesión]");
    const rate = gv(val, "rate", "2");
    const buy = gv(val, "buyback", "[monto]");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "royalty",
      reference: ctx.reference,
      date: ctx.date,
      title: "NET SMELTER RETURN ROYALTY AGREEMENT",
      blocks: [
        {
          kind: "paragraph",
          text: `${G} constituye a favor de ${Bf} una regalía NSR del ${rate}% sobre la producción de la concesión ${conc}.`,
        },
        {
          kind: "fields",
          rows: [
            ["Otorgante", G],
            ["Beneficiario", Bf],
            ["Concesión", conc],
            ["Tasa NSR", `${rate}%`],
            ["Recompra", `USD ${buy} por cada 0,5% de NSR`],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. BASE DE CÁLCULO. Ingresos por venta de productos menos fundición, refinación, transporte y seguros ("Net Smelter Return").`,
            `2. PAGO. Mensual, dentro de los 15 días siguientes al cierre de mes.`,
            `3. RECOMPRA. El Otorgante podrá recomprar hasta el 50% del royalty en tramos de 0,5% a USD ${buy} cada uno.`,
            ...(active.has("audit")
              ? [`4. AUDITORÍA. ${royalty.clauses.find((c) => c.key === "audit")!.text}`]
              : []),
            ...(active.has("advance")
              ? [`5. ANTICIPOS. ${royalty.clauses.find((c) => c.key === "advance")!.text}`]
              : []),
            `6. INSCRIPCIÓN. Este royalty se inscribirá como gravamen sobre la concesión en el Registro correspondiente.`,
            `7. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [G, Bf] },
      ],
    };
  },
};

/* ─────────────── Advisory ─────────────── */
const advisory: TemplateDef = {
  id: "advisory",
  title: "Advisory Agreement",
  shortTitle: "Advisory",
  category: "legal",
  summary:
    "Contrato de asesoría estratégica o financiera con retainer y success fee, típico para colocación de capital.",
  fields: [
    { key: "client", label: "Cliente", type: "text" },
    { key: "advisor", label: "Asesor", type: "text", default: OWN_PARTY_LINE },
    { key: "scope", label: "Alcance de servicios", type: "textarea" },
    { key: "retainer", label: "Retainer mensual (USD)", type: "text", default: "5,000" },
    { key: "successPct", label: "Success fee (%)", type: "number", default: "3" },
    { key: "termMonths", label: "Vigencia (meses)", type: "number", default: "12" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "tail",
      label: "Tail fee 18 meses",
      defaultOn: true,
      text: "Si dentro de 18 meses post-terminación el Cliente cierra una transacción con contrapartes introducidas por el Asesor, el success fee será igualmente exigible.",
    },
    {
      key: "expenses",
      label: "Reembolso de gastos > USD 500",
      defaultOn: true,
      text: "El Cliente reembolsará gastos preaprobados y superiores a USD 500 (viajes, data room, terceros).",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const C = bracket(gv(val, "client"), "Cliente");
    const Ad = bracket(gv(val, "advisor"), "Asesor");
    const scope = gv(
      val,
      "scope",
      "asesoría estratégica y financiera para levantamiento de capital y estructuración de la operación.",
    );
    const retainer = gv(val, "retainer", "5,000");
    const success = gv(val, "successPct", "3");
    const term = gv(val, "termMonths", "12");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "advisory",
      reference: ctx.reference,
      date: ctx.date,
      title: "ADVISORY AGREEMENT",
      blocks: [
        {
          kind: "paragraph",
          text: `${C} contrata a ${Ad} para prestar servicios de asesoría según se detalla.`,
        },
        {
          kind: "fields",
          rows: [
            ["Cliente", C],
            ["Asesor", Ad],
            ["Alcance", scope],
            ["Retainer mensual", `USD ${retainer}`],
            ["Success fee", `${success}% del monto levantado o valor de la transacción`],
            ["Vigencia", `${term} meses, renovables`],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. HONORARIOS. Retainer mensual de USD ${retainer} + success fee de ${success}%.`,
            `2. INDEPENDENCIA. El Asesor actúa como contratista independiente; no existe relación laboral.`,
            ...(active.has("tail")
              ? [`3. TAIL. ${advisory.clauses.find((c) => c.key === "tail")!.text}`]
              : []),
            ...(active.has("expenses")
              ? [`4. GASTOS. ${advisory.clauses.find((c) => c.key === "expenses")!.text}`]
              : []),
            `5. CONFIDENCIALIDAD. El Asesor mantendrá confidencialidad conforme al NDA suscrito.`,
            `6. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [C, Ad] },
      ],
    };
  },
};

/* ─────────────── Data Sheet de lote (commodity) ─────────────── */
const dataSheet: TemplateDef = {
  id: "data-sheet",
  title: "Data Sheet de Lote (Commodity)",
  shortTitle: "Data Sheet",
  acronym: "DS",
  category: "trade",
  summary:
    "Ficha técnica comercial de un lote físico (concentrado, cátodo, doré…): especificaciones, logística y verificación. Puede precargarse desde un lote del marketplace.",
  fields: [
    {
      key: "seller",
      label: "Vendedor / originador",
      type: "text",
      placeholder: "Razón social",
      default: OWN_PARTY_LINE,
      group: "Identificación",
    },
    {
      key: "lotTitle",
      label: "Título del lote",
      type: "text",
      placeholder: "Ej.: Concentrado de cobre — Lote Norte",
      group: "Identificación",
    },
    {
      key: "product",
      label: "Producto / commodity",
      type: "text",
      placeholder: "Ej.: Concentrado de cobre",
      group: "Especificación",
    },
    {
      key: "form",
      label: "Forma",
      type: "text",
      placeholder: "Concentrado / cátodo / doré…",
      group: "Especificación",
    },
    {
      key: "grade",
      label: "Ley / pureza",
      type: "text",
      placeholder: "Ej.: 24,5 % Cu",
      group: "Especificación",
    },
    {
      key: "moisture",
      label: "Humedad (%)",
      type: "number",
      placeholder: "8",
      group: "Especificación",
    },
    {
      key: "deleterious",
      label: "Elementos penalizables declarados",
      type: "textarea",
      placeholder: "Ej.: As 0,18 % · Sb 0,05 %",
      group: "Especificación",
    },
    {
      key: "tonnage",
      label: "Tonelaje disponible (t)",
      type: "number",
      placeholder: "1000",
      group: "Volumen",
    },
    {
      key: "lotSize",
      label: "Tamaño de lote (t)",
      type: "number",
      placeholder: "100",
      group: "Volumen",
    },
    {
      key: "frequency",
      label: "Frecuencia de entrega",
      type: "text",
      placeholder: "Spot / mensual / trimestral",
      group: "Volumen",
    },
    {
      key: "origin",
      label: "Origen (país / región)",
      type: "text",
      placeholder: "Chile · Coquimbo",
      group: "Logística",
    },
    {
      key: "port",
      label: "Puerto de embarque",
      type: "text",
      placeholder: "Ej.: Puerto de Coquimbo",
      group: "Logística",
    },
    {
      key: "incoterm",
      label: "Incoterm",
      type: "text",
      placeholder: "FOB / CIF…",
      group: "Logística",
    },
    {
      key: "priceBasis",
      label: "Base de precio",
      type: "text",
      placeholder: "Ej.: LME M+1 menos TC/RC",
      group: "Comercial",
    },
    {
      key: "paymentTerms",
      label: "Términos de pago",
      type: "text",
      placeholder: "Ej.: 90% provisional / 10% final",
      group: "Comercial",
    },
    {
      key: "certifications",
      label: "Certificaciones",
      type: "textarea",
      placeholder: "Ej.: SGS, ISO 9001, cadena de custodia",
      group: "Verificación",
    },
    {
      key: "kymScore",
      label: "Score Know-Your-Mine (0-100)",
      type: "number",
      placeholder: "—",
      help: "Se precarga automáticamente si el data sheet se genera desde un lote verificado.",
      group: "Verificación",
    },
    {
      key: "contact",
      label: "Contacto comercial",
      type: "text",
      placeholder: "nombre · email",
      group: "Identificación",
    },
  ],
  clauses: [
    {
      key: "confidential",
      label: "Nota de confidencialidad",
      defaultOn: true,
      text: "Este data sheet es confidencial y se entrega únicamente para la evaluación comercial del lote descrito. Su distribución a terceros requiere autorización escrita del vendedor.",
    },
    {
      key: "subjectToAssay",
      label: "Sujeto a análisis final (ensaye)",
      defaultOn: true,
      text: "Las especificaciones indicadas son referenciales y quedan sujetas al análisis final (ensaye) de laboratorio independiente acordado por las partes en el contrato definitivo.",
    },
    {
      key: "kymNote",
      label: "Nota de verificación Geocapitals (KYM)",
      defaultOn: true,
      text: "El lote y su contraparte fueron evaluados por el motor Know-Your-Mine de Geocapitals contra fuentes catastrales y legales oficiales. El score es una señal de debida diligencia y no constituye garantía.",
    },
    {
      key: "notOffer",
      label: "No constituye oferta vinculante",
      defaultOn: true,
      text: "Este documento es informativo y no constituye una oferta vinculante de venta ni compromiso de suministro; los términos definitivos se establecerán en el contrato de compraventa (SPA).",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const seller = bracket(gv(val, "seller"), "Vendedor");
    const kym = gv(val, "kymScore");
    const specRows: string[][] = [
      ["Producto", bracket(gv(val, "product"), "producto")],
      ["Forma", gv(val, "form", "—")],
      ["Ley / pureza", gv(val, "grade", "—")],
      ["Humedad", gv(val, "moisture") ? `${gv(val, "moisture")} %` : "—"],
      ["Penalizables", gv(val, "deleterious", "No declarados")],
    ];
    const volRows: string[][] = [
      ["Tonelaje disponible", gv(val, "tonnage") ? `${gv(val, "tonnage")} t` : "—"],
      ["Tamaño de lote", gv(val, "lotSize") ? `${gv(val, "lotSize")} t` : "—"],
      ["Frecuencia", gv(val, "frequency", "—")],
      ["Origen", gv(val, "origin", "—")],
      ["Puerto de embarque", gv(val, "port", "—")],
      ["Incoterm", gv(val, "incoterm", "—")],
      ["Base de precio", gv(val, "priceBasis", "—")],
      ["Términos de pago", gv(val, "paymentTerms", "—")],
    ];
    const clauseItems = [
      ...(active.has("confidential")
        ? [dataSheet.clauses.find((c) => c.key === "confidential")!.text]
        : []),
      ...(active.has("subjectToAssay")
        ? [dataSheet.clauses.find((c) => c.key === "subjectToAssay")!.text]
        : []),
      ...(active.has("kymNote") ? [dataSheet.clauses.find((c) => c.key === "kymNote")!.text] : []),
      ...(active.has("notOffer")
        ? [dataSheet.clauses.find((c) => c.key === "notOffer")!.text]
        : []),
    ];
    return {
      docType: "data-sheet",
      reference: ctx.reference,
      date: ctx.date,
      title: "COMMODITY DATA SHEET",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["Vendedor", seller],
            ["Lote", gv(val, "lotTitle", "—")],
            ["Contacto", gv(val, "contact", "—")],
            ...(kym
              ? ([["Verificación KYM", `${kym} / 100 (Geocapitals)`]] as Array<[string, string]>)
              : []),
          ],
        },
        { kind: "table", head: ["Especificación", "Valor"], rows: specRows },
        { kind: "table", head: ["Volumen y comercial", "Detalle"], rows: volRows },
        ...(gv(val, "certifications")
          ? ([
              { kind: "paragraph", text: `Certificaciones: ${gv(val, "certifications")}` },
            ] as DocBlock[])
          : []),
        { kind: "clauses", items: clauseItems },
        { kind: "signature", parties: [seller] },
      ],
    };
  },
};

export const TEMPLATES: TemplateDef[] = [
  nda,
  ndi,
  mou,
  loi,
  termSheet,
  spa,
  jv,
  royalty,
  advisory,
  dataSheet,
];

export const TEMPLATE_BY_ID: Record<string, TemplateDef> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t]),
);

export const CATEGORY_LABEL: Record<string, string> = {
  legal: "Legales & confidencialidad",
  inversion: "M&A e inversión",
  trade: "Trade & commodities",
};

// Referencia auto-generada para el documento.
export function buildReference(id: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `GC-${id.toUpperCase()}-${y}${m}${d}-${rand}`;
}

// Helper para bloques usados por el editor de preview
export type { DocBlock };
