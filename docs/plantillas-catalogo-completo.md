# Catálogo completo de plantillas de operación — handoff a Lovable

> Cubre los 40 documentos del checklist REICON (cátodos de cobre) + los instrumentos
> estándar de mercado. **Distinción clave:** solo se generan plantillas para los
> documentos que **redacta el proveedor/las partes** (declaraciones, statements,
> políticas, instrumentos). Los **emitidos por terceros** (permisos, licencias, cartas
> bancarias, ISO, COO, BL) NO se templatean: el proveedor los obtiene y los sube; el
> checklist ya lo rastrea (`status = falta/subido/...`).
>
> Territorio: la librería es `src/lib/documents/templates.ts` (**Lovable**). Aquí van
> los `TemplateDef` listos para pegar + su registro. **Esqueletos de borrador**, no
> asesoría legal (revisión de abogado pendiente).

## 1. Disposición de los 40 documentos REICON

| #   | doc_kind                      | Disposición                                   | template id             |
| --- | ----------------------------- | --------------------------------------------- | ----------------------- |
| 1   | mining_permit                 | Subir (autoridad minera)                      | —                       |
| 2   | upstream_invoice              | **Generar**                                   | `commercial-invoice`    |
| 3   | export_authorization          | Subir (autoridad)                             | —                       |
| 4   | certificate_of_origin         | Subir (cámara de comercio)                    | —                       |
| 5   | mandate_letter                | **Generar**                                   | `mandate-letter`        |
| 6   | business_license              | Subir (registro mercantil)                    | —                       |
| 7   | articles_of_association       | Subir (doc corporativo)                       | —                       |
| 8   | trade_license                 | Subir (autoridad)                             | —                       |
| 9   | mining_authority_registration | Subir (autoridad)                             | —                       |
| 10  | operational_address_proof     | Subir (escritura/arriendo)                    | —                       |
| 11  | directors_shareholders_id     | Subir                                         | —                       |
| 12  | ubo_declaration               | **Generar**                                   | `ubo-declaration`       |
| 13  | corporate_org_chart           | Subir (diagrama)                              | —                       |
| 14  | bank_reference_letter         | Subir (banco)                                 | —                       |
| 15  | banking_coordinates           | **Generar**                                   | `banking-coordinates`   |
| 16  | audited_financials            | Subir (auditor)                               | —                       |
| 17  | tax_compliance_certificates   | Subir (autoridad tributaria)                  | —                       |
| 18  | trade_references              | **Generar**                                   | `trade-references`      |
| 19  | production_capacity_statement | **Generar**                                   | `production-capacity`   |
| 20  | refining_process_description  | **Generar**                                   | `refining-process`      |
| 21  | annual_production_volume      | **Generar** (dentro de `production-capacity`) | `production-capacity`   |
| 22  | typical_lot_size              | **Generar** (usar `data-sheet` existente)     | `data-sheet`            |
| 23  | iso_certifications            | Subir (certificadora)                         | —                       |
| 24  | lme_compliance                | Subir                                         | —                       |
| 25  | esg_policy                    | **Generar**                                   | `esg-policy`            |
| 26  | environmental_management      | **Generar**                                   | `environmental-policy`  |
| 27  | community_engagement_policy   | **Generar**                                   | `community-policy`      |
| 28  | governance_ethics_framework   | **Generar**                                   | `governance-policy`     |
| 29  | conflict_free_certificate     | Subir (ICGLR)                                 | —                       |
| 30  | traceability_documentation    | Subir (ITSCI)                                 | —                       |
| 31  | sanctions_declaration         | **Generar**                                   | `sanctions-declaration` |
| 32  | sanctions_screening           | Screening (panel GC, no upload)               | —                       |
| 33  | anticorruption_policy         | **Generar**                                   | `anticorruption-policy` |
| 34  | code_of_conduct               | **Generar**                                   | `code-of-conduct`       |
| 35  | labor_law_compliance          | **Generar** (declaración)                     | `labor-declaration`     |
| 36  | human_rights_policy           | **Generar**                                   | `human-rights-policy`   |
| 37  | previous_contracts            | Subir                                         | —                       |
| 38  | export_logistics_docs         | Subir                                         | —                       |
| 39  | bl_samples                    | Subir                                         | —                       |
| 40  | prior_buyer_references        | **Generar**                                   | `buyer-references`      |

**Resumen:** ~18 REICON generables · ~20 subir (terceros) · 1 screening.

## 2. Instrumentos estándar de mercado

Ya en la librería: NDA, **NCNDA (ndi)**, MoU, LOI, Term Sheet, SPA (equity), JV,
Royalty, Advisory, Data Sheet, **ICPO, FCO, IMFPA** (PR #199).
A agregar aquí: `supply-contract` (contrato de suministro / SPA de mercancías), `bcl`
(Bank Comfort Letter), `pop` (Proof of Product), `pof` (Proof of Funds), `soft-probe`
(autorización de verificación bancaria), `commercial-invoice`, `packing-list`.

## 3. Integración (Lovable, en `/src`)

1. Pega los bloques de código de abajo en `src/lib/documents/templates.ts` (antes de
   `export const TEMPLATES`).
2. Registra todos en el array `TEMPLATES = [ ..., <nuevos> ]`.
3. Aparecen solos en `/dashboard/documentos` por categoría.
4. En el detalle del trade / War Room del proveedor, ofrece "Generar" para los
   templatables y "Subir" para los de tercero (el checklist ya distingue por doc_kind).
5. Al generar, guarda el borrador en `document_drafts` (template_id + values), como el NCNDA.

---

## 4. Factory de POLÍTICAS (ESG, ambiental, comunidad, gobernanza, anticorrupción, conducta, DD.HH.)

```ts
/* Fábrica para políticas corporativas: mismo esqueleto, distinto contenido. */
function makePolicy(
  id: string,
  acronym: string,
  title: string,
  summary: string,
  statements: string[],
): TemplateDef {
  return {
    id,
    acronym,
    shortTitle: acronym,
    title,
    category: "legal",
    summary,
    fields: [
      { key: "company", label: "Empresa", type: "text", default: OWN_PARTY_LINE },
      {
        key: "scope",
        label: "Alcance / operaciones cubiertas",
        type: "textarea",
        placeholder: "Sitios, filiales y actividades cubiertas",
      },
      {
        key: "approver",
        label: "Aprobado por (cargo)",
        type: "text",
        placeholder: "Directorio / Gerencia General",
      },
      { key: "reviewCycle", label: "Ciclo de revisión", type: "text", default: "Anual" },
      { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
    ],
    clauses: [
      {
        key: "grievance",
        label: "Incluir mecanismo de reclamos/denuncias",
        defaultOn: true,
        text: "La empresa mantiene un canal confidencial de reclamos y denuncias, sin represalias, accesible a trabajadores y terceros.",
      },
    ],
    build: (val, active, ctx): GeneratedDoc => {
      const company = bracket(gv(val, "company"), "Empresa");
      const scope = gv(val, "scope", "[alcance]");
      const approver = gv(val, "approver", "[órgano aprobador]");
      const cycle = gv(val, "reviewCycle", "Anual");
      const jur = gv(val, "jurisdiction", "República de Chile");
      return {
        docType: id,
        reference: ctx.reference,
        date: ctx.date,
        title: title.toUpperCase(),
        blocks: [
          {
            kind: "paragraph",
            text: `${company} adopta la presente ${title} con alcance sobre ${scope}.`,
          },
          {
            kind: "fields",
            rows: [
              ["Empresa", company],
              ["Alcance", scope],
              ["Aprobada por", approver],
              ["Revisión", cycle],
              ["Jurisdicción", jur],
            ],
          },
          {
            kind: "clauses",
            items: renumber(
              [
                ...statements,
                ...(active.has("grievance")
                  ? [
                      makePolicy.name &&
                        "MECANISMO DE RECLAMOS. La empresa mantiene un canal confidencial de reclamos y denuncias, sin represalias.",
                    ]
                  : []),
                `GOBERNANZA. Esta política es aprobada por ${approver}, con revisión ${cycle.toLowerCase()} y comunicación a todo el personal.`,
                `LEY APLICABLE. Se interpreta conforme a la legislación de ${jur} y a los estándares internacionales aplicables.`,
              ].filter(Boolean) as string[],
            ),
          },
          { kind: "signature", parties: [company] },
        ],
      };
    },
  };
}

const esgPolicy = makePolicy(
  "esg-policy",
  "ESG",
  "Política ESG / Sostenibilidad",
  "Compromisos ambientales, sociales y de gobernanza del proveedor.",
  [
    "COMPROMISO ESG. La empresa integra criterios ambientales, sociales y de gobernanza en sus operaciones y cadena de suministro.",
    "DEBIDA DILIGENCIA. Evalúa y mitiga impactos ambientales y sociales conforme a estándares OCDE de cadenas de suministro responsables.",
    "TRANSPARENCIA. Reporta periódicamente su desempeño ESG a sus contrapartes cuando es requerido.",
  ],
);
const environmentalPolicy = makePolicy(
  "environmental-policy",
  "AMB",
  "Política de Gestión Ambiental",
  "Prácticas de gestión ambiental del proveedor.",
  [
    "CUMPLIMIENTO. Opera conforme a la normativa ambiental aplicable y a sus permisos vigentes.",
    "GESTIÓN. Mantiene un sistema de gestión ambiental (residuos, agua, emisiones) con metas de mejora continua.",
  ],
);
const communityPolicy = makePolicy(
  "community-policy",
  "COM",
  "Política de Relacionamiento Comunitario",
  "Relacionamiento con comunidades del entorno.",
  [
    "RELACIONAMIENTO. Mantiene diálogo de buena fe con las comunidades del área de influencia.",
    "CONSULTA. Respeta los procesos de consulta y participación que correspondan según la ley.",
  ],
);
const governancePolicy = makePolicy(
  "governance-policy",
  "GOB",
  "Marco de Gobernanza y Ética",
  "Estructura de gobernanza y ética corporativa.",
  [
    "GOBIERNO CORPORATIVO. Cuenta con órganos de gobierno definidos y segregación de funciones.",
    "ÉTICA. Prohíbe conflictos de interés no declarados y exige conducta ética a directores y empleados.",
  ],
);
const anticorruptionPolicy = makePolicy(
  "anticorruption-policy",
  "AC",
  "Política Anticorrupción y Antisoborno",
  "Prohibición de corrupción y soborno.",
  [
    "PROHIBICIÓN. Prohíbe todo acto de corrupción, soborno, pagos de facilitación y tráfico de influencias.",
    "TERCEROS. Extiende la prohibición a intermediarios, agentes y socios comerciales.",
    "SANCIONES. Toda infracción es causal de sanción interna y de terminación de relaciones comerciales.",
  ],
);
const codeOfConduct = makePolicy(
  "code-of-conduct",
  "COC",
  "Código de Conducta",
  "Estándares de conducta de la empresa.",
  [
    "INTEGRIDAD. El personal actúa con honestidad, legalidad y respeto en todas sus actividades.",
    "CONFLICTOS. Los conflictos de interés se declaran y gestionan de forma transparente.",
  ],
);
const humanRightsPolicy = makePolicy(
  "human-rights-policy",
  "DDHH",
  "Política de Derechos Humanos",
  "Respeto a los derechos humanos en la operación y la cadena.",
  [
    "RESPETO. Respeta los derechos humanos conforme a los Principios Rectores de la ONU sobre empresas y derechos humanos.",
    "TRABAJO. Prohíbe el trabajo forzoso e infantil y respeta la libertad de asociación.",
  ],
);
```

## 5. DECLARACIONES y STATEMENTS del proveedor

```ts
/* Carta de Autorización / Mandato */
const mandateLetter: TemplateDef = {
  id: "mandate-letter",
  acronym: "MANDATO",
  shortTitle: "Mandato",
  category: "trade",
  title: "Carta de Autorización (Mandate Letter)",
  summary: "La mina/productor autoriza al proveedor o broker a comercializar el producto.",
  fields: [
    { key: "principal", label: "Mina / Productor (mandante)", type: "text" },
    { key: "agent", label: "Mandatario (proveedor/broker)", type: "text", default: OWN_PARTY_LINE },
    { key: "commodity", label: "Producto autorizado", type: "text" },
    {
      key: "scope",
      label: "Alcance de la representación",
      type: "textarea",
      default: "Comercialización y presentación ante compradores",
    },
    { key: "termMonths", label: "Duración (meses)", type: "number", default: "12" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => {
    const principal = bracket(gv(val, "principal"), "Mandante");
    const agent = bracket(gv(val, "agent"), "Mandatario");
    const commodity = gv(val, "commodity", "[producto]");
    const scope = gv(val, "scope", "comercialización");
    const term = gv(val, "termMonths", "12");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "mandate-letter",
      reference: ctx.reference,
      date: ctx.date,
      title: "LETTER OF AUTHORIZATION (MANDATE)",
      blocks: [
        {
          kind: "paragraph",
          text: `${principal} (el "Mandante") autoriza a ${agent} (el "Mandatario") a ${scope} respecto de ${commodity}.`,
        },
        {
          kind: "fields",
          rows: [
            ["Mandante", principal],
            ["Mandatario", agent],
            ["Producto", commodity],
            ["Alcance", scope],
            ["Duración", `${term} meses`],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. AUTORIZACIÓN. El Mandante autoriza al Mandatario a representar y comercializar ${commodity} dentro del alcance indicado.`,
            `2. VIGENCIA. ${term} meses desde la firma, renovable por acuerdo escrito.`,
            `3. FACULTADES. El Mandatario no compromete al Mandante más allá del alcance expresamente autorizado.`,
            `4. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [principal] },
      ],
    };
  },
};

/* Declaración de Beneficiario Final (UBO) */
const uboDeclaration: TemplateDef = {
  id: "ubo-declaration",
  acronym: "UBO",
  shortTitle: "UBO",
  category: "legal",
  title: "Declaración de Beneficiario Final (UBO)",
  summary: "Declaración de los beneficiarios finales que controlan la empresa.",
  fields: [
    { key: "company", label: "Empresa", type: "text", default: OWN_PARTY_LINE },
    {
      key: "ubos",
      label: "Beneficiarios finales (>25%)",
      type: "textarea",
      placeholder: "Nombre · nacionalidad · % participación (uno por línea)",
    },
    { key: "declarant", label: "Declarante (cargo)", type: "text" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => {
    const company = bracket(gv(val, "company"), "Empresa");
    const ubos = gv(val, "ubos", "[beneficiarios finales]");
    const declarant = bracket(gv(val, "declarant"), "Declarante");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "ubo-declaration",
      reference: ctx.reference,
      date: ctx.date,
      title: "ULTIMATE BENEFICIAL OWNERSHIP (UBO) DECLARATION",
      blocks: [
        {
          kind: "paragraph",
          text: `${company} declara sus beneficiarios finales conforme a la normativa de prevención de lavado de activos.`,
        },
        {
          kind: "fields",
          rows: [
            ["Empresa", company],
            ["Beneficiarios finales", ubos],
            ["Declarante", declarant],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. VERACIDAD. El declarante manifiesta bajo su responsabilidad que la información de beneficiarios finales es completa y veraz.`,
            `2. ACTUALIZACIÓN. Se compromete a informar cualquier cambio en la estructura de control.`,
            `3. LEY APLICABLE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [company] },
      ],
    };
  },
};

/* Coordenadas Bancarias */
const bankingCoordinates: TemplateDef = {
  id: "banking-coordinates",
  acronym: "BANK",
  shortTitle: "Banco",
  category: "trade",
  title: "Coordenadas Bancarias",
  summary: "Datos bancarios completos del proveedor para la operación.",
  fields: [
    { key: "holder", label: "Titular de la cuenta", type: "text", default: OWN_PARTY_LINE },
    { key: "bank", label: "Banco", type: "text" },
    { key: "swift", label: "SWIFT/BIC", type: "text" },
    { key: "account", label: "IBAN / N° de cuenta", type: "text" },
    { key: "currency", label: "Moneda", type: "text", default: "USD" },
    { key: "intermediary", label: "Banco intermediario (si aplica)", type: "text" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => ({
    docType: "banking-coordinates",
    reference: ctx.reference,
    date: ctx.date,
    title: "BANKING COORDINATES",
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Titular", bracket(gv(val, "holder"), "Titular")],
          ["Banco", gv(val, "bank", "[banco]")],
          ["SWIFT/BIC", gv(val, "swift", "[SWIFT]")],
          ["IBAN/Cuenta", gv(val, "account", "[cuenta]")],
          ["Moneda", gv(val, "currency", "USD")],
          ["Intermediario", gv(val, "intermediary", "—")],
        ],
      },
      {
        kind: "clauses",
        items: [
          "1. Estas coordenadas son válidas para la operación en curso; cualquier cambio se comunicará por escrito y se verificará banco a banco.",
        ],
      },
      { kind: "signature", parties: [bracket(gv(val, "holder"), "Titular")] },
    ],
  }),
};

/* Referencias comerciales / de compradores previos (mismo shape) */
function makeReferences(id: string, title: string, summary: string): TemplateDef {
  return {
    id,
    acronym: "REF",
    shortTitle: "Referencias",
    category: "trade",
    title,
    summary,
    fields: [
      { key: "company", label: "Empresa", type: "text", default: OWN_PARTY_LINE },
      {
        key: "refs",
        label: "Referencias",
        type: "textarea",
        placeholder: "Contraparte · contacto · operación · monto/volumen (una por línea)",
      },
    ],
    clauses: [],
    build: (val, _a, ctx): GeneratedDoc => ({
      docType: id,
      reference: ctx.reference,
      date: ctx.date,
      title: title.toUpperCase(),
      blocks: [
        {
          kind: "paragraph",
          text: `${bracket(gv(val, "company"), "Empresa")} presenta las siguientes referencias.`,
        },
        {
          kind: "fields",
          rows: [
            ["Empresa", bracket(gv(val, "company"), "Empresa")],
            ["Referencias", gv(val, "refs", "[referencias]")],
          ],
        },
        { kind: "signature", parties: [bracket(gv(val, "company"), "Empresa")] },
      ],
    }),
  };
}
const tradeReferences = makeReferences(
  "trade-references",
  "Referencias Comerciales",
  "Bancos y socios comerciales que respaldan al proveedor.",
);
const buyerReferences = makeReferences(
  "buyer-references",
  "Referencias de Compradores Previos",
  "Compradores anteriores como referencia de desempeño.",
);

/* Declaración anti-sanciones / conflicto */
const sanctionsDeclaration: TemplateDef = {
  id: "sanctions-declaration",
  acronym: "SANC",
  shortTitle: "Anti-sanciones",
  category: "legal",
  title: "Declaración Anti-Sanciones y Origen No-Conflicto",
  summary: "Declara que el material no proviene de regiones sancionadas o en conflicto.",
  fields: [
    { key: "company", label: "Empresa", type: "text", default: OWN_PARTY_LINE },
    { key: "commodity", label: "Producto", type: "text" },
    { key: "origin", label: "Origen del material", type: "text" },
    { key: "declarant", label: "Declarante (cargo)", type: "text" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => {
    const company = bracket(gv(val, "company"), "Empresa");
    const commodity = gv(val, "commodity", "[producto]");
    const origin = gv(val, "origin", "[origen]");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "sanctions-declaration",
      reference: ctx.reference,
      date: ctx.date,
      title: "SANCTIONS & CONFLICT-FREE ORIGIN DECLARATION",
      blocks: [
        {
          kind: "paragraph",
          text: `${company} declara respecto de ${commodity}, origen ${origin}, lo siguiente:`,
        },
        {
          kind: "clauses",
          items: renumber([
            `1. ORIGEN NO-CONFLICTO. El material no proviene de regiones en conflicto ni de fuentes que financien grupos armados.`,
            `2. SANCIONES. Ni la empresa ni sus beneficiarios finales están incluidos en listas OFAC, ONU, UE o UK, ni el material proviene de jurisdicciones sancionadas.`,
            `3. VERACIDAD. La declaración se hace bajo responsabilidad del declarante y se acepta el screening independiente por la contraparte.`,
            `4. LEY APLICABLE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [company] },
      ],
    };
  },
};

/* Declaración de cumplimiento laboral */
const laborDeclaration: TemplateDef = {
  id: "labor-declaration",
  acronym: "LAB",
  shortTitle: "Laboral",
  category: "legal",
  title: "Declaración de Cumplimiento Laboral",
  summary: "Declara cumplimiento de la legislación laboral aplicable.",
  fields: [
    { key: "company", label: "Empresa", type: "text", default: OWN_PARTY_LINE },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => {
    const company = bracket(gv(val, "company"), "Empresa");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "labor-declaration",
      reference: ctx.reference,
      date: ctx.date,
      title: "LABOR LAW COMPLIANCE DECLARATION",
      blocks: [
        {
          kind: "clauses",
          items: renumber([
            `1. ${company} declara cumplir la legislación laboral y de seguridad social aplicable en ${jur}.`,
            `2. Prohíbe el trabajo forzoso e infantil en su operación y cadena directa.`,
            `3. Mantiene condiciones de higiene y seguridad conforme a la normativa vigente.`,
          ]),
        },
        { kind: "signature", parties: [company] },
      ],
    };
  },
};

/* Declaración de capacidad de producción (cubre volumen anual y proceso resumido) */
const productionCapacity: TemplateDef = {
  id: "production-capacity",
  acronym: "PROD",
  shortTitle: "Producción",
  category: "trade",
  title: "Declaración de Capacidad de Producción",
  summary: "Capacidad, volumen anual, tamaño típico de lote y resumen del proceso.",
  fields: [
    { key: "company", label: "Empresa / planta", type: "text", default: OWN_PARTY_LINE },
    { key: "commodity", label: "Producto", type: "text" },
    { key: "annualVolume", label: "Volumen anual (MT)", type: "number" },
    { key: "monthlyCapacity", label: "Capacidad mensual (MT)", type: "number" },
    { key: "lotSize", label: "Tamaño típico de lote (MT)", type: "number" },
    { key: "process", label: "Proceso de refinación (resumen)", type: "textarea" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => ({
    docType: "production-capacity",
    reference: ctx.reference,
    date: ctx.date,
    title: "PRODUCTION CAPACITY STATEMENT",
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Empresa/planta", bracket(gv(val, "company"), "Empresa")],
          ["Producto", gv(val, "commodity", "[producto]")],
          ["Volumen anual", `${gv(val, "annualVolume", "[—]")} MT`],
          ["Capacidad mensual", `${gv(val, "monthlyCapacity", "[—]")} MT`],
          ["Lote típico", `${gv(val, "lotSize", "[—]")} MT`],
        ],
      },
      {
        kind: "paragraph",
        text: `Proceso de refinación: ${gv(val, "process", "[resumen del proceso]")}`,
      },
      { kind: "signature", parties: [bracket(gv(val, "company"), "Empresa")] },
    ],
  }),
};

/* Descripción de proceso de refinación (detalle) */
const refiningProcess: TemplateDef = {
  id: "refining-process",
  acronym: "REF-PROC",
  shortTitle: "Refinación",
  category: "trade",
  title: "Descripción del Proceso de Refinación",
  summary: "Detalle del proceso productivo/refinación del producto.",
  fields: [
    { key: "company", label: "Empresa / planta", type: "text", default: OWN_PARTY_LINE },
    { key: "commodity", label: "Producto", type: "text" },
    {
      key: "process",
      label: "Descripción del proceso",
      type: "textarea",
      placeholder: "Etapas, tecnología, controles de calidad",
    },
    {
      key: "quality",
      label: "Especificación de calidad final",
      type: "text",
      placeholder: "Ej.: LME Grado A 99,99% Cu",
    },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => ({
    docType: "refining-process",
    reference: ctx.reference,
    date: ctx.date,
    title: "REFINING PROCESS DESCRIPTION",
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Empresa/planta", bracket(gv(val, "company"), "Empresa")],
          ["Producto", gv(val, "commodity", "[producto]")],
          ["Calidad final", gv(val, "quality", "[spec]")],
        ],
      },
      { kind: "paragraph", text: gv(val, "process", "[descripción del proceso]") },
      { kind: "signature", parties: [bracket(gv(val, "company"), "Empresa")] },
    ],
  }),
};
```

## 6. INSTRUMENTOS estándar de mercado (nuevos)

```ts
/* Contrato de suministro / SPA de mercancías (goods) */
const supplyContract: TemplateDef = {
  id: "supply-contract",
  acronym: "SPA-G",
  shortTitle: "Contrato suministro",
  category: "trade",
  title: "Contrato de Compraventa de Mercancías (SPA de commodities)",
  summary:
    "Contrato definitivo de suministro: producto, calidad, volumen, precio, entrega, pago e inspección.",
  fields: [
    { key: "seller", label: "Vendedor", type: "text", default: OWN_PARTY_LINE },
    { key: "buyer", label: "Comprador", type: "text" },
    { key: "commodity", label: "Producto y especificación", type: "text" },
    { key: "quantityTotal", label: "Cantidad total (MT)", type: "number" },
    { key: "incoterm", label: "Incoterm 2020 + puerto", type: "text", default: "CIF" },
    { key: "price", label: "Precio / fórmula", type: "text" },
    {
      key: "payment",
      label: "Condiciones de pago",
      type: "text",
      default: "DLC irrevocable a la vista",
    },
    {
      key: "inspection",
      label: "Inspección",
      type: "text",
      default: "SGS/CIQ en carga y descarga",
    },
    {
      key: "jurisdiction",
      label: "Jurisdicción / arbitraje",
      type: "text",
      default: "República de Chile",
    },
  ],
  clauses: [
    {
      key: "forceMajeure",
      label: "Fuerza mayor",
      defaultOn: true,
      text: "Ninguna parte responde por incumplimientos derivados de fuerza mayor debidamente acreditada.",
    },
    {
      key: "title",
      label: "Transferencia de dominio y riesgo",
      defaultOn: true,
      text: "El dominio y el riesgo se transfieren conforme al Incoterm pactado.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const seller = bracket(gv(val, "seller"), "Vendedor");
    const buyer = bracket(gv(val, "buyer"), "Comprador");
    const commodity = gv(val, "commodity", "[producto]");
    const qty = gv(val, "quantityTotal", "[—]");
    const incoterm = gv(val, "incoterm", "CIF");
    const price = gv(val, "price", "[precio/fórmula]");
    const pay = gv(val, "payment", "DLC irrevocable a la vista");
    const insp = gv(val, "inspection", "SGS/CIQ");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "supply-contract",
      reference: ctx.reference,
      date: ctx.date,
      title: "SALES & PURCHASE AGREEMENT (COMMODITIES)",
      blocks: [
        {
          kind: "paragraph",
          text: `Entre ${seller} (el "Vendedor") y ${buyer} (el "Comprador") se celebra el presente contrato de compraventa de ${commodity}.`,
        },
        {
          kind: "fields",
          rows: [
            ["Vendedor", seller],
            ["Comprador", buyer],
            ["Producto", commodity],
            ["Cantidad total", `${qty} MT`],
            ["Entrega", incoterm],
            ["Precio", price],
            ["Pago", pay],
            ["Inspección", insp],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. OBJETO. El Vendedor vende y el Comprador compra ${commodity}, cantidad ${qty} MT, con la especificación de calidad acordada.`,
            `2. PRECIO. ${price}. Ajustes por calidad/cantidad según inspección ${insp}.`,
            `3. PAGO. ${pay}, emitido por banco de primer orden contra documentos conformes.`,
            `4. ENTREGA. ${incoterm} (Incoterms 2020), según calendario de embarques.`,
            ...(active.has("title")
              ? [`5. DOMINIO Y RIESGO. ${supplyContract.clauses[1].text}`]
              : []),
            ...(active.has("forceMajeure")
              ? [`6. FUERZA MAYOR. ${supplyContract.clauses[0].text}`]
              : []),
            `7. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [seller, buyer] },
      ],
    };
  },
};

/* Cartas simples: BCL / POP / POF / Soft Probe */
function makeLetter(
  id: string,
  acronym: string,
  title: string,
  summary: string,
  body: string[],
): TemplateDef {
  return {
    id,
    acronym,
    shortTitle: acronym,
    category: "trade",
    title,
    summary,
    fields: [
      { key: "issuer", label: "Emisor", type: "text", default: OWN_PARTY_LINE },
      { key: "beneficiary", label: "Dirigida a", type: "text" },
      { key: "commodity", label: "Operación / producto", type: "text" },
      { key: "amount", label: "Monto / volumen", type: "text" },
      { key: "validityDays", label: "Validez (días)", type: "number", default: "30" },
    ],
    clauses: [],
    build: (val, _a, ctx): GeneratedDoc => {
      const issuer = bracket(gv(val, "issuer"), "Emisor");
      const to = bracket(gv(val, "beneficiary"), "Destinatario");
      const commodity = gv(val, "commodity", "[operación]");
      const amount = gv(val, "amount", "[monto/volumen]");
      const validity = gv(val, "validityDays", "30");
      return {
        docType: id,
        reference: ctx.reference,
        date: ctx.date,
        title: title.toUpperCase(),
        blocks: [
          {
            kind: "paragraph",
            text: `${issuer} emite la presente ${title} a favor de ${to}, en relación con ${commodity} (${amount}).`,
          },
          {
            kind: "clauses",
            items: renumber(
              body.map((b) => b.replace("{amount}", amount).replace("{validity}", validity)),
            ),
          },
          { kind: "signature", parties: [issuer] },
        ],
      };
    },
  };
}
const bcl = makeLetter(
  "bcl",
  "BCL",
  "Bank Comfort Letter",
  "Carta de confort bancaria (capacidad financiera).",
  [
    "El banco del Comprador confirma, a título informativo y no operativo, que su cliente mantiene fondos/línea suficientes para la operación por {amount}.",
    "Esta carta no constituye garantía de pago ni compromiso bancario, y es válida por {validity} días.",
  ],
);
const pop = makeLetter("pop", "POP", "Proof of Product", "Prueba de producto del vendedor.", [
  "El Vendedor declara disponer del producto objeto de la operación ({amount}) y se obliga a acreditarlo documentalmente una vez el instrumento de pago sea operativo.",
  "Válida por {validity} días.",
]);
const pof = makeLetter("pof", "POF", "Proof of Funds", "Prueba de fondos del comprador.", [
  "El Comprador declara disponer de fondos/línea por {amount} para la operación, sujeto a verificación banco a banco.",
  "Válida por {validity} días.",
]);
const softProbe = makeLetter(
  "soft-probe",
  "PROBE",
  "Autorización de Verificación Bancaria (Soft Probe)",
  "Autoriza verificación no operativa de capacidad financiera.",
  [
    "El titular autoriza una verificación bancaria NO operativa (soft probe) de su capacidad financiera por {amount}, a solicitud de la contraparte o su banco.",
    "La autorización es válida por {validity} días y no habilita débito ni bloqueo de fondos.",
  ],
);

/* Factura comercial y packing list (documentos de embarque) */
const commercialInvoice: TemplateDef = {
  id: "commercial-invoice",
  acronym: "INV",
  shortTitle: "Factura",
  category: "trade",
  title: "Factura Comercial (Commercial Invoice)",
  summary: "Factura comercial de la operación (upstream o de venta).",
  fields: [
    { key: "seller", label: "Emisor (vendedor)", type: "text", default: OWN_PARTY_LINE },
    { key: "buyer", label: "Comprador", type: "text" },
    { key: "commodity", label: "Producto", type: "text" },
    { key: "quantity", label: "Cantidad (MT)", type: "number" },
    { key: "unitPrice", label: "Precio unitario (USD/MT)", type: "number" },
    { key: "incoterm", label: "Incoterm + puerto", type: "text", default: "CIF" },
    { key: "invoiceNo", label: "N° de factura", type: "text" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => {
    const qty = Number(gv(val, "quantity", "0"));
    const up = Number(gv(val, "unitPrice", "0"));
    const total = qty && up ? (qty * up).toLocaleString("en-US") : "[total]";
    return {
      docType: "commercial-invoice",
      reference: ctx.reference,
      date: ctx.date,
      title: "COMMERCIAL INVOICE",
      blocks: [
        {
          kind: "fields",
          rows: [
            ["N° factura", gv(val, "invoiceNo", "[—]")],
            ["Vendedor", bracket(gv(val, "seller"), "Vendedor")],
            ["Comprador", bracket(gv(val, "buyer"), "Comprador")],
            ["Incoterm", gv(val, "incoterm", "CIF")],
          ],
        },
        {
          kind: "table",
          head: ["Producto", "Cantidad (MT)", "USD/MT", "Total USD"],
          rows: [
            [gv(val, "commodity", "[producto]"), String(qty || "[—]"), String(up || "[—]"), total],
          ],
        },
        { kind: "signature", parties: [bracket(gv(val, "seller"), "Vendedor")] },
      ],
    };
  },
};
const packingList: TemplateDef = {
  id: "packing-list",
  acronym: "PACK",
  shortTitle: "Packing List",
  category: "trade",
  title: "Lista de Empaque (Packing List)",
  summary: "Detalle de bultos/lotes del embarque.",
  fields: [
    { key: "seller", label: "Vendedor", type: "text", default: OWN_PARTY_LINE },
    { key: "commodity", label: "Producto", type: "text" },
    {
      key: "packages",
      label: "Bultos / lotes",
      type: "textarea",
      placeholder: "N° lote · bultos · peso neto/bruto (uno por línea)",
    },
    { key: "totalWeight", label: "Peso total (MT)", type: "number" },
  ],
  clauses: [],
  build: (val, _a, ctx): GeneratedDoc => ({
    docType: "packing-list",
    reference: ctx.reference,
    date: ctx.date,
    title: "PACKING LIST",
    blocks: [
      {
        kind: "fields",
        rows: [
          ["Vendedor", bracket(gv(val, "seller"), "Vendedor")],
          ["Producto", gv(val, "commodity", "[producto]")],
          ["Peso total", `${gv(val, "totalWeight", "[—]")} MT`],
        ],
      },
      { kind: "paragraph", text: gv(val, "packages", "[detalle de bultos/lotes]") },
      { kind: "signature", parties: [bracket(gv(val, "seller"), "Vendedor")] },
    ],
  }),
};
```

## 7. Registro (agregar al array `TEMPLATES`)

```ts
export const TEMPLATES: TemplateDef[] = [
  /* ...existentes... */
  // Políticas
  esgPolicy,
  environmentalPolicy,
  communityPolicy,
  governancePolicy,
  anticorruptionPolicy,
  codeOfConduct,
  humanRightsPolicy,
  // Declaraciones y statements
  mandateLetter,
  uboDeclaration,
  bankingCoordinates,
  tradeReferences,
  buyerReferences,
  sanctionsDeclaration,
  laborDeclaration,
  productionCapacity,
  refiningProcess,
  // Instrumentos de mercado
  supplyContract,
  bcl,
  pop,
  pof,
  softProbe,
  commercialInvoice,
  packingList,
];
```

## 8. Nota legal (obligatoria)

Todos son **esqueletos de borrador** con estructura estándar de mercado (ICC / Incoterms
2020 / OCDE / Principios ONU). **No** son asesoría legal ni están verificados por
abogado. Antes de usarlos en una operación real deben revisarse y ajustarse a la
jurisdicción y a la operación concreta.
