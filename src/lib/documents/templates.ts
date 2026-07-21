// Catálogo de plantillas editables de Geocapitals: NDA, NDI, MoU, LOI, Term
// Sheet, SPA (esqueleto), JV, Royalty/NSR y Advisory. Lógica pura; el editor
// y el renderer PDF consumen estas definiciones.

import type { TemplateDef, GeneratedDoc, DocBlock, FieldDef } from "./model";
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
      [
        "OBJETO",
        `El presente acuerdo regula el intercambio de información confidencial entre las Partes con el fin de ${purpose}.`,
      ],
      [
        "INFORMACIÓN CONFIDENCIAL",
        `Se considera confidencial toda información técnica, geológica, financiera, comercial o legal entregada por ${mode === "mutuo" ? "cualquiera de las Partes" : `${A}`} en cualquier formato.`,
      ],
      [
        "USO",
        `La información será utilizada exclusivamente para el propósito indicado y no podrá divulgarse a terceros sin autorización previa y por escrito.`,
      ],
      [
        "VIGENCIA",
        `Las obligaciones de este acuerdo tendrán una duración de ${term} meses contados desde su firma.`,
      ],
    ];
    if (active.has("nonCircumvention"))
      raw.push(["NO ELUSIÓN", nda.clauses.find((c) => c.key === "nonCircumvention")!.text]);
    if (active.has("returnInfo"))
      raw.push(["DEVOLUCIÓN", nda.clauses.find((c) => c.key === "returnInfo")!.text]);
    if (active.has("penalty"))
      raw.push(["PENALIDAD", nda.clauses.find((c) => c.key === "penalty")!.text]);
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

/* ─────────────── NCNDA (ICC — bilingüe, 3 posiciones) ─────────────── */
// Plantilla alineada al formato estándar ICC/NCNDA que circula en el mercado
// (Carpio & Kaddu / KYC Vetting): cláusulas bilingües EN/ES, arbitraje ICC,
// vigencia 5+2 años y hasta 3 posiciones firmantes con datos completos.

type NcndaPos = "A" | "B" | "C";
const NCNDA_POS: { key: NcndaPos; label: string; ord: string }[] = [
  { key: "A", label: "1ª Posición · Firmante", ord: "1st Position / 1ª Posición" },
  { key: "B", label: "2ª Posición · Firmante", ord: "2nd Position / 2ª Posición" },
  { key: "C", label: "3ª Posición · Firmante (Geocapitals)", ord: "3rd Position / 3ª Posición" },
];

function ncndaPosFields(
  p: NcndaPos,
  group: string,
  defaults: Partial<Record<string, string>> = {},
): FieldDef[] {
  const k = (s: string) => `p${p}_${s}`;
  return [
    {
      key: k("name"),
      label: "Nombre completo del firmante / Signatory's Full Name",
      type: "text",
      group,
      default: defaults.name,
    },
    {
      key: k("passport"),
      label: "N.º de Pasaporte / Passport No.",
      type: "text",
      group,
      default: defaults.passport,
    },
    {
      key: k("nationality"),
      label: "Nacionalidad / Nationality",
      type: "text",
      group,
      default: defaults.nationality,
    },
    {
      key: k("company"),
      label: "Empresa / Company Name",
      type: "text",
      group,
      default: defaults.company,
    },
    {
      key: k("position"),
      label: "Cargo / Position",
      type: "text",
      group,
      default: defaults.position,
    },
    {
      key: k("address"),
      label: "Dirección / Company Address",
      type: "text",
      group,
      default: defaults.address,
    },
    { key: k("phone"), label: "Teléfono / Phone", type: "text", group, default: defaults.phone },
    { key: k("email"), label: "Correo / E-mail", type: "text", group, default: defaults.email },
    { key: k("country"), label: "País / Country", type: "text", group, default: defaults.country },
  ];
}

function ncndaPosRows(val: Record<string, string>, p: NcndaPos): [string, string][] {
  const g = (s: string) => gv(val, `p${p}_${s}`, "—");
  return [
    ["Nombre / Name", g("name")],
    ["Pasaporte / Passport", g("passport")],
    ["Nacionalidad / Nationality", g("nationality")],
    ["Empresa / Company", g("company")],
    ["Cargo / Position", g("position")],
    ["Dirección / Address", g("address")],
    ["Teléfono / Phone", g("phone")],
    ["Correo / E-mail", g("email")],
    ["País / Country", g("country")],
  ];
}

const ncnda: TemplateDef = {
  id: "ncnda",
  title: "NCNDA — No Elusión y Confidencialidad (ICC, bilingüe)",
  shortTitle: "NCNDA",
  acronym: "NCNDA",
  category: "trade",
  summary:
    "Non-Circumvention Non-Disclosure Agreement conforme a las reglas de la Cámara de Comercio Internacional (ICC), bilingüe EN/ES, con hasta tres posiciones firmantes.",
  fields: [
    {
      key: "commodity",
      label: "Commodity / Material",
      type: "text",
      placeholder: "Antimony Ingot 99.85% (Sb)",
      group: "Operación",
    },
    {
      key: "destination",
      label: "Destino del material / Destination",
      type: "text",
      placeholder: "Florida, USA",
      group: "Operación",
    },
    {
      key: "termYears",
      label: "Vigencia (años) / Term (years)",
      type: "number",
      default: "5",
      group: "Operación",
    },
    {
      key: "renewalYears",
      label: "Renovación (años) / Renewal (years)",
      type: "number",
      default: "2",
      group: "Operación",
    },
    ...ncndaPosFields("A", NCNDA_POS[0].label),
    ...ncndaPosFields("B", NCNDA_POS[1].label),
    ...ncndaPosFields("C", NCNDA_POS[2].label, {
      name: "Álvaro Cumora Oliva Herrera",
      company: "Asesorías Terra SpA (Geocapitals)",
      position: "Representante Legal",
      country: "Chile",
      email: "info@geocapitals.com",
    }),
  ],
  clauses: [
    {
      key: "penalty",
      label: "Penalidad por elusión / Circumvention Penalty",
      defaultOn: true,
      text: "Circumvention Penalty / Penalidad por Elusión. Any breach of the non-circumvention obligation entitles the aggrieved party to a compensation equal to five percent (5%) of the gross value of the circumvented transaction, without prejudice to further damages under ICC rules. — Cualquier incumplimiento de la obligación de no elusión facultará a la Parte agraviada a exigir una compensación equivalente al cinco por ciento (5%) del valor bruto de la operación circunvenida, sin perjuicio de daños adicionales conforme a las reglas ICC.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const commodity = gv(val, "commodity", "[commodity]");
    const destination = gv(val, "destination", "[destination / destino]");
    const term = gv(val, "termYears", "5");
    const renewal = gv(val, "renewalYears", "2");

    const partyLine = (p: NcndaPos): string => {
      const company = gv(val, `p${p}_company`, "");
      const name = gv(val, `p${p}_name`, "");
      const country = gv(val, `p${p}_country`, "");
      return [company, name, country].filter(Boolean).join(" · ") || `[Parte ${p}]`;
    };
    const A = partyLine("A");
    const B = partyLine("B");
    const C = partyLine("C");

    const items = [
      `Object / Objeto. The Parties enter into this Non-Circumvention Non-Disclosure Agreement (NCNDA) to exchange technical, commercial and financial information regarding transactions on ${commodity} with destination ${destination}, safeguarding such information and the commercial relationships identified by each Party. — Las Partes suscriben este Acuerdo de No Elusión y No Divulgación (NCNDA) con el objeto de intercambiar información técnica, comercial y financiera relativa a operaciones sobre ${commodity} con destino ${destination}, protegiendo dicha información y las relaciones comerciales identificadas por cada Parte.`,
      `Non-Circumvention / No Elusión. Each Party undertakes not to contact, negotiate or contract, directly or indirectly, with producers, buyers, financiers, agents or representatives introduced by the other Party, without its prior written consent, during the term of this agreement and for a further twelve (12) months. — Cada Parte se obliga a no contactar, negociar ni contratar, directa o indirectamente, con productores, compradores, financistas, agentes o representantes identificados por la otra Parte, sin su consentimiento previo y por escrito, durante la vigencia y por doce (12) meses adicionales.`,
      `Non-Disclosure / Confidencialidad. All technical (assays, certificates, chain of custody), commercial (prices, volumes, counterparties) and operational information shall be deemed confidential and shall not be disclosed to third parties except under identical confidentiality obligations. — Toda información técnica (ensayos, certificados, cadena de custodia), comercial (precios, cantidades, contrapartes) y operativa se considerará confidencial y no podrá ser divulgada a terceros salvo bajo idénticas obligaciones de reserva.`,
      `Term / Vigencia. This agreement shall remain in force for ${term} year(s) from the date hereof, renewable for a further ${renewal} year(s) upon written agreement, and shall apply to all originated, follow-up, repeated, extended or renegotiated transactions. — Este acuerdo estará vigente por ${term} año(s) desde su firma, renovable por ${renewal} año(s) adicionales previo acuerdo escrito, y se aplicará a todas las transacciones originadas, de seguimiento, repetidas, extendidas o renegociadas.`,
      `Arbitration / Arbitraje. All disputes arising out of or in connection with this agreement shall be finally settled under the Rules of Arbitration of the International Chamber of Commerce (ICC) by one or more arbitrators appointed in accordance with said rules; awards shall be binding and enforceable at law. — Toda controversia derivada de o en conexión con el presente acuerdo se resolverá definitivamente bajo las Reglas de Arbitraje de la Cámara de Comercio Internacional (ICC) por uno o más árbitros designados según dichas reglas; los laudos serán vinculantes y ejecutables por ley.`,
      `Force Majeure / Fuerza Mayor. No Party shall be deemed in breach when the violation is due to circumstances beyond its reasonable control, including acts of God, civil disturbances or theft of privileged information without the intervention of any Party. — Ninguna Parte se considerará en incumplimiento cuando la violación se deba a circunstancias fuera de su control razonable, incluyendo actos de fuerza mayor, disturbios civiles o robo de información privilegiada sin intervención de las Partes.`,
      `Owned or Controlled Entities / Entidades Controladas. This agreement binds all entities owned or controlled by a Party and its principals, employees, assignees, family and heirs; neither Party may assign this agreement without the other's prior written consent. — Este acuerdo obliga a todas las entidades de propiedad o controladas por cada Parte y a sus principales, empleados, cesionarios, familia y herederos; ninguna Parte podrá cederlo sin el consentimiento previo y por escrito de la otra.`,
      `Electronic Transmission / Transmisión Electrónica. Transmission of this agreement by e-mail or electronic means shall be legal and binding upon the Parties. — La transmisión de este acuerdo por correo electrónico o medios electrónicos será legal y vinculante para las Partes.`,
      `Not a Partnership / No Asociación. This agreement shall not be construed as a partnership; no Party shall have any claim against separate dealings, ventures or assets of the others, nor shall be liable for any other Party. — Este acuerdo no se interpretará como asociación; ninguna Parte tendrá reclamo contra operaciones, empresas o activos separados de las otras, ni será responsable por ellas.`,
      `Third-Party Projects / Proyectos con Terceros. Any project to be shared with third parties for strategic or contractual reasons shall require mutual written acceptance of the signatories and the execution of a separate NCNDA with the new participant limited to that project. — Todo proyecto que se comparta con terceros por razones estratégicas o contractuales requerirá aceptación mutua y por escrito de los firmantes y la suscripción de un NCNDA independiente con el nuevo participante, limitado a ese proyecto.`,
      active.has("penalty") ? ncnda.clauses.find((c) => c.key === "penalty")!.text : "",
      `Agreed and Attested / Acordado y Atestiguado. Each signatory below warrants that he/she is duly empowered by the named company to enter into and be bound by the obligations contained herein. — Cada firmante garantiza estar debidamente facultado por la empresa indicada para suscribir y quedar obligado por los compromisos aquí contenidos.`,
    ].filter(Boolean);

    const blocks: DocBlock[] = [
      {
        kind: "paragraph",
        text: `Between ${A}, ${B} and ${C} (collectively "The Parties") this Non-Circumvention Non-Disclosure Agreement (NCNDA) is executed under the following clauses. — Entre ${A}, ${B} y ${C} (en conjunto, "Las Partes") se celebra el presente Acuerdo de No Elusión y No Divulgación (NCNDA) conforme a las siguientes cláusulas.`,
      },
      {
        kind: "fields",
        rows: [
          ["Commodity / Material", commodity],
          ["Destino / Destination", destination],
          ["Vigencia / Term", `${term} año(s) + ${renewal} año(s) de renovación`],
          ["Foro / Forum", "ICC — International Chamber of Commerce"],
        ],
      },
      { kind: "clauses", items: renumber(items) },
    ];

    // Bloques de datos por posición firmante (equivalentes a las tablas del PDF ICC).
    for (const pos of NCNDA_POS) {
      blocks.push({ kind: "paragraph", text: pos.ord });
      blocks.push({ kind: "fields", rows: ncndaPosRows(val, pos.key) });
    }

    blocks.push({ kind: "signature", parties: [A, B, C] });

    return {
      docType: "ncnda",
      reference: ctx.reference,
      date: ctx.date,
      title: "NON-CIRCUMVENTION & NON-DISCLOSURE AGREEMENT (NCNDA)",
      blocks,
    };
  },
};

/* ─────────────── ICPO (Orden de Compra Corporativa Irrevocable) ─────────────── */
const icpo: TemplateDef = {
  id: "icpo",
  title: "Orden de Compra Corporativa Irrevocable (ICPO)",
  shortTitle: "ICPO",
  acronym: "ICPO",
  category: "trade",
  summary:
    "Orden irrevocable emitida por el comprador para adquirir un commodity, previa a la FCO/SPA.",
  fields: [
    { key: "buyer", label: "Comprador (emisor)", type: "text", default: OWN_PARTY_LINE },
    { key: "seller", label: "Vendedor", type: "text" },
    {
      key: "commodity",
      label: "Commodity / Material",
      type: "text",
      placeholder: "Antimony Ingot 99.85% (Sb)",
    },
    {
      key: "spec",
      label: "Especificación / Grado",
      type: "text",
      placeholder: "Grade 2# · 99.75–99.90%",
    },
    { key: "quantity", label: "Cantidad", type: "text", placeholder: "1,500 TM" },
    { key: "incoterm", label: "Incoterm", type: "text", default: "CIF" },
    { key: "destination", label: "Puerto de destino", type: "text", placeholder: "Florida, USA" },
    { key: "price", label: "Precio objetivo (USD/t)", type: "text", placeholder: "—" },
    { key: "payment", label: "Instrumento de pago", type: "text", default: "SBLC MT760" },
    { key: "validityDays", label: "Validez (días)", type: "number", default: "10" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => {
    const B = bracket(gv(val, "buyer"), "Comprador");
    const S = bracket(gv(val, "seller"), "Vendedor");
    const commodity = gv(val, "commodity", "[commodity]");
    const spec = gv(val, "spec", "[especificación]");
    const quantity = gv(val, "quantity", "[cantidad]");
    const incoterm = gv(val, "incoterm", "CIF");
    const destination = gv(val, "destination", "[destino]");
    const price = gv(val, "price", "[precio]");
    const payment = gv(val, "payment", "SBLC MT760");
    const validity = gv(val, "validityDays", "10");
    return {
      docType: "icpo",
      reference: ctx.reference,
      date: ctx.date,
      title: "ORDEN DE COMPRA CORPORATIVA IRREVOCABLE (ICPO)",
      blocks: [
        {
          kind: "paragraph",
          text: `${B} (el "Comprador") emite de forma irrevocable la presente orden de compra a ${S} (el "Vendedor") por el suministro de ${commodity}, con capacidad financiera confirmable, sujeta a la aceptación mediante Oferta Corporativa Completa (FCO) y al contrato de compraventa (SPA) definitivo.`,
        },
        {
          kind: "fields",
          rows: [
            ["Comprador", B],
            ["Vendedor", S],
            ["Commodity", commodity],
            ["Especificación", spec],
            ["Cantidad", quantity],
            ["Incoterm", incoterm],
            ["Puerto de destino", destination],
            ["Precio objetivo", `USD ${price}/t`],
            ["Instrumento de pago", payment],
            ["Validez", `${validity} días`],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. Esta ICPO es irrevocable dentro de su validez y expresa la intención firme de compra del Comprador, sujeta a due diligence, FCO del Vendedor y firma del SPA definitivo.`,
            `2. El instrumento de pago (${payment}) se emitirá contra documentos conforme al SPA; las coordenadas bancarias se intercambiarán bajo el acuerdo de no elusión y confidencialidad vigente.`,
            `3. Las Partes se obligan a la no elusión y confidencialidad respecto de contrapartes, precios y condiciones aquí referidas.`,
            `4. Esta orden no constituye por sí sola contrato de compraventa; su perfeccionamiento requiere el SPA firmado por ambas Partes.`,
          ]),
        },
        { kind: "signature", parties: [B] },
      ],
    };
  },
};

/* ─────────────── FCO (Oferta Corporativa Completa) ─────────────── */
const fco: TemplateDef = {
  id: "fco",
  title: "Oferta Corporativa Completa (FCO)",
  shortTitle: "FCO",
  acronym: "FCO",
  category: "trade",
  summary: "Oferta firme emitida por el vendedor en respuesta a la ICPO, previa al SPA.",
  fields: [
    { key: "seller", label: "Vendedor (emisor)", type: "text", default: OWN_PARTY_LINE },
    { key: "buyer", label: "Comprador", type: "text" },
    {
      key: "commodity",
      label: "Commodity / Material",
      type: "text",
      placeholder: "Antimony Ingot 99.85% (Sb)",
    },
    {
      key: "spec",
      label: "Especificación / Grado",
      type: "text",
      placeholder: "Grade 2# · 99.75–99.90%",
    },
    { key: "quantity", label: "Cantidad ofertada", type: "text", placeholder: "1,500 TM" },
    { key: "origin", label: "Origen", type: "text", placeholder: "Bolivia / Chile" },
    { key: "incoterm", label: "Incoterm", type: "text", default: "CIF" },
    { key: "price", label: "Precio (USD/t)", type: "text", placeholder: "—" },
    {
      key: "payment",
      label: "Condiciones de pago",
      type: "text",
      default: "SBLC MT760 irrevocable",
    },
    {
      key: "delivery",
      label: "Programa de entrega",
      type: "text",
      placeholder: "12 meses, spot + parciales",
    },
    { key: "validityDays", label: "Validez (días)", type: "number", default: "10" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => {
    const S = bracket(gv(val, "seller"), "Vendedor");
    const B = bracket(gv(val, "buyer"), "Comprador");
    const commodity = gv(val, "commodity", "[commodity]");
    const spec = gv(val, "spec", "[especificación]");
    const quantity = gv(val, "quantity", "[cantidad]");
    const origin = gv(val, "origin", "[origen]");
    const incoterm = gv(val, "incoterm", "CIF");
    const price = gv(val, "price", "[precio]");
    const payment = gv(val, "payment", "SBLC MT760 irrevocable");
    const delivery = gv(val, "delivery", "[programa de entrega]");
    const validity = gv(val, "validityDays", "10");
    return {
      docType: "fco",
      reference: ctx.reference,
      date: ctx.date,
      title: "OFERTA CORPORATIVA COMPLETA (FCO)",
      blocks: [
        {
          kind: "paragraph",
          text: `${S} (el "Vendedor") ofrece de forma firme a ${B} (el "Comprador") el suministro de ${commodity}, en respuesta a su ICPO, sujeta a la firma del contrato de compraventa (SPA) definitivo y a la emisión del instrumento de pago acordado.`,
        },
        {
          kind: "fields",
          rows: [
            ["Vendedor", S],
            ["Comprador", B],
            ["Commodity", commodity],
            ["Especificación", spec],
            ["Cantidad ofertada", quantity],
            ["Origen", origin],
            ["Incoterm", incoterm],
            ["Precio", `USD ${price}/t`],
            ["Pago", payment],
            ["Entrega", delivery],
            ["Validez", `${validity} días`],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. Esta FCO constituye una oferta firme del Vendedor dentro de su validez, sujeta a la firma del SPA definitivo y a la verificación de capacidad de pago del Comprador.`,
            `2. El pago se estructura mediante ${payment}, operable contra los documentos de embarque conforme al SPA (factura, B/L, certificados SGS y de origen).`,
            `3. El Vendedor garantiza la disponibilidad y trazabilidad del material conforme a la especificación indicada; toda inspección se realizará por entidad independiente (SGS u otra acordada).`,
            `4. Rige entre las Partes la obligación de no elusión y confidencialidad; esta oferta no constituye contrato hasta la firma del SPA.`,
          ]),
        },
        { kind: "signature", parties: [S] },
      ],
    };
  },
};

export const TEMPLATES: TemplateDef[] = [
  nda,
  ndi,
  ncnda,
  mou,
  icpo,
  fco,
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
