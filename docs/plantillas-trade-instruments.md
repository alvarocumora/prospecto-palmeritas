# Plantillas de instrumentos de trade (ICPO / FCO / IMFPA) — handoff a Lovable

> La librería de plantillas vive en `src/lib/documents/templates.ts` (**territorio
> Lovable**). Ya tiene NDA, **NCNDA (ndi)**, MoU, LOI, Term Sheet, SPA, JV, Royalty,
> Advisory, Data Sheet. Para **intermediación de commodities** faltan los tres
> instrumentos clásicos de abajo. Están escritos en el **mismo formato `TemplateDef`**
> (helpers `gv`/`bracket`/`renumber`/`jurisdictionClause`/`OWN_PARTY_LINE` ya existen),
> listos para pegar.
>
> **Son ESQUELETOS de borrador** (igual que los SPA/JV existentes, marcados
> "esqueleto"): estructura y cláusulas estándar de comercio internacional para
> agilizar, **no** asesoría legal. Deben pasar por revisión del abogado antes de usar
> en una operación real.

## Cómo integrarlos (Lovable, en `/src`)

1. Pega los tres `TemplateDef` de abajo en `src/lib/documents/templates.ts` (antes del
   `export const TEMPLATES`).
2. Agrégalos al array: `export const TEMPLATES = [ ..., icpo, fco, imfpa ]`.
3. Aparecerán solos en `/dashboard/documentos` (categoría `trade`) y en el editor/PDF,
   porque el editor consume `TEMPLATES`.
4. Opcional: en el detalle del trade, botón "Generar ICPO/FCO/IMFPA" que precargue los
   `fields` desde `commodity_trades` (commodity, cantidad, incoterm, precio, contraparte)
   y guarde el borrador en `document_drafts` (template_id + values), como ya hace el NCNDA.

---

```ts
/* ─────────────── ICPO (Irrevocable Corporate Purchase Order) ─────────────── */
const icpo: TemplateDef = {
  id: "icpo",
  title: "Orden de Compra Corporativa Irrevocable (ICPO)",
  shortTitle: "ICPO",
  acronym: "ICPO",
  category: "trade",
  summary:
    "Orden de compra corporativa irrevocable emitida por el comprador para iniciar una operación: producto, volumen, precio objetivo, Incoterm e instrumento de pago.",
  fields: [
    { key: "buyer", label: "Comprador", type: "text", placeholder: "Razón social + tax id" },
    { key: "seller", label: "Vendedor / Proveedor", type: "text", default: OWN_PARTY_LINE },
    {
      key: "commodity",
      label: "Producto y especificación",
      type: "text",
      placeholder: "Ej.: cátodo de cobre LME Grado A 99,99%",
    },
    { key: "quantityMonthly", label: "Cantidad mensual (MT)", type: "number" },
    { key: "quantityTotal", label: "Cantidad total del contrato (MT)", type: "number" },
    {
      key: "incoterm",
      label: "Incoterm 2020",
      type: "select",
      default: "CIF",
      options: [
        { value: "CIF", label: "CIF" },
        { value: "CFR", label: "CFR" },
        { value: "FOB", label: "FOB" },
        { value: "DAP", label: "DAP" },
        { value: "DDP", label: "DDP" },
      ],
    },
    { key: "destination", label: "Puerto / país de destino", type: "text" },
    {
      key: "targetPrice",
      label: "Precio objetivo (USD/MT o fórmula)",
      type: "text",
      placeholder: "Ej.: LME cash - 5% o USD 9.450/MT",
    },
    {
      key: "paymentInstrument",
      label: "Instrumento de pago",
      type: "select",
      default: "DLC",
      options: [
        { value: "DLC", label: "DLC/LC irrevocable a la vista" },
        { value: "SBLC", label: "SBLC" },
        { value: "TT", label: "TT / MT103" },
        { value: "BG", label: "Garantía bancaria (BG)" },
      ],
    },
    { key: "validityDays", label: "Validez de la orden (días)", type: "number", default: "10" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "softProbe",
      label: "Autoriza verificación bancaria no operativa (soft probe)",
      defaultOn: true,
      text: "El Comprador autoriza una verificación bancaria no operativa (soft probe) de su capacidad financiera, a solicitud del Vendedor o de su banco.",
    },
    {
      key: "iccProcedure",
      label: "Cierre según guías ICC",
      defaultOn: true,
      text: "El procedimiento de cierre seguirá, en lo aplicable, las guías de la Cámara de Comercio Internacional (ICC) para operaciones de comercio de materias primas.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const buyer = bracket(gv(val, "buyer"), "Comprador");
    const seller = bracket(gv(val, "seller"), "Vendedor");
    const commodity = gv(val, "commodity", "[producto y especificación]");
    const qM = gv(val, "quantityMonthly", "[—]");
    const qT = gv(val, "quantityTotal", "[—]");
    const incoterm = gv(val, "incoterm", "CIF");
    const dest = gv(val, "destination", "[puerto/país de destino]");
    const price = gv(val, "targetPrice", "[precio objetivo]");
    const pay = gv(val, "paymentInstrument", "DLC");
    const validity = gv(val, "validityDays", "10");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "icpo",
      reference: ctx.reference,
      date: ctx.date,
      title: "IRREVOCABLE CORPORATE PURCHASE ORDER (ICPO)",
      blocks: [
        {
          kind: "paragraph",
          text: `${buyer} (el "Comprador") emite la presente Orden de Compra Corporativa Irrevocable a favor de ${seller} (el "Vendedor") para la adquisición de ${commodity}.`,
        },
        {
          kind: "fields",
          rows: [
            ["Comprador", buyer],
            ["Vendedor", seller],
            ["Producto", commodity],
            ["Cantidad mensual", `${qM} MT`],
            ["Cantidad total", `${qT} MT`],
            ["Incoterm 2020", `${incoterm} ${dest}`],
            ["Precio objetivo", price],
            ["Instrumento de pago", pay],
            ["Validez", `${validity} días`],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. OBJETO. El Comprador se compromete irrevocablemente a adquirir el producto y cantidades indicados, sujeto a la aceptación del Vendedor mediante su Oferta Corporativa (FCO) y a la firma del contrato definitivo.`,
            `2. PRECIO Y AJUSTE. El precio se establece en ${price}, sujeto al mecanismo de ajuste y a la inspección de calidad/cantidad en puerto acordada por las Partes.`,
            `3. PAGO. El pago se instrumentará mediante ${pay}, emitido por banco de primer orden, contra documentos de embarque conformes.`,
            `4. INCOTERM. La entrega se pacta ${incoterm} ${dest} (Incoterms 2020).`,
            `5. VALIDEZ. La presente orden es válida por ${validity} días desde su emisión.`,
            ...(active.has("softProbe") ? [`6. VERIFICACIÓN. ${icpo.clauses[0].text}`] : []),
            ...(active.has("iccProcedure") ? [`7. PROCEDIMIENTO. ${icpo.clauses[1].text}`] : []),
            `8. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [buyer] },
      ],
    };
  },
};

/* ─────────────── FCO (Full Corporate Offer) ─────────────── */
const fco: TemplateDef = {
  id: "fco",
  title: "Oferta Corporativa Completa (FCO)",
  shortTitle: "FCO",
  acronym: "FCO",
  category: "trade",
  summary:
    "Oferta corporativa completa emitida por el vendedor en respuesta a un ICPO: especificación, volúmenes, precio, condiciones de pago y procedimiento de operación.",
  fields: [
    { key: "seller", label: "Vendedor / Proveedor", type: "text", default: OWN_PARTY_LINE },
    { key: "buyer", label: "Comprador", type: "text", placeholder: "Razón social + tax id" },
    {
      key: "commodity",
      label: "Producto y especificación",
      type: "text",
      placeholder: "Ej.: cátodo de cobre LME Grado A 99,99%",
    },
    { key: "origin", label: "Origen", type: "text", placeholder: "País / mina / refinería" },
    { key: "quantityMonthly", label: "Cantidad mensual (MT)", type: "number" },
    { key: "quantityTotal", label: "Cantidad total del contrato (MT)", type: "number" },
    {
      key: "incoterm",
      label: "Incoterm 2020",
      type: "select",
      default: "CIF",
      options: [
        { value: "CIF", label: "CIF" },
        { value: "CFR", label: "CFR" },
        { value: "FOB", label: "FOB" },
        { value: "DAP", label: "DAP" },
        { value: "DDP", label: "DDP" },
      ],
    },
    { key: "loadingPort", label: "Puerto de carga", type: "text" },
    {
      key: "price",
      label: "Precio (USD/MT o fórmula)",
      type: "text",
      placeholder: "Ej.: LME cash - 4%",
    },
    {
      key: "paymentTerms",
      label: "Condiciones de pago",
      type: "text",
      default: "DLC irrevocable a la vista contra documentos",
    },
    {
      key: "inspection",
      label: "Inspección",
      type: "text",
      default: "SGS/CIQ en carga y descarga, a cargo de cada parte según Incoterm",
    },
    { key: "validityDays", label: "Validez de la oferta (días)", type: "number", default: "7" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "pop",
      label: "Compromiso de Prueba de Producto (POP) tras LC operativa",
      defaultOn: true,
      text: "El Vendedor entregará la Prueba de Producto (POP) documental una vez que el instrumento de pago del Comprador sea operativo y verificado banco a banco.",
    },
    {
      key: "iccProcedure",
      label: "Procedimiento según guías ICC",
      defaultOn: true,
      text: "El procedimiento de operación seguirá, en lo aplicable, las guías de la Cámara de Comercio Internacional (ICC).",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const seller = bracket(gv(val, "seller"), "Vendedor");
    const buyer = bracket(gv(val, "buyer"), "Comprador");
    const commodity = gv(val, "commodity", "[producto y especificación]");
    const origin = gv(val, "origin", "[origen]");
    const qM = gv(val, "quantityMonthly", "[—]");
    const qT = gv(val, "quantityTotal", "[—]");
    const incoterm = gv(val, "incoterm", "CIF");
    const port = gv(val, "loadingPort", "[puerto de carga]");
    const price = gv(val, "price", "[precio]");
    const pay = gv(val, "paymentTerms", "DLC irrevocable a la vista");
    const insp = gv(val, "inspection", "SGS/CIQ");
    const validity = gv(val, "validityDays", "7");
    const jur = gv(val, "jurisdiction", "República de Chile");
    return {
      docType: "fco",
      reference: ctx.reference,
      date: ctx.date,
      title: "FULL CORPORATE OFFER (FCO)",
      blocks: [
        {
          kind: "paragraph",
          text: `${seller} (el "Vendedor") presenta la presente Oferta Corporativa Completa a ${buyer} (el "Comprador") para el suministro de ${commodity}, origen ${origin}.`,
        },
        {
          kind: "fields",
          rows: [
            ["Vendedor", seller],
            ["Comprador", buyer],
            ["Producto", commodity],
            ["Origen", origin],
            ["Cantidad mensual", `${qM} MT`],
            ["Cantidad total", `${qT} MT`],
            ["Incoterm 2020", `${incoterm} — ${port}`],
            ["Precio", price],
            ["Pago", pay],
            ["Inspección", insp],
            ["Validez", `${validity} días`],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. OFERTA. El Vendedor ofrece el producto y cantidades indicados, sujeto a contrato definitivo y a la disponibilidad confirmada al momento de la aceptación.`,
            `2. PRECIO. ${price}, con el mecanismo de ajuste e inspección ${insp}.`,
            `3. PAGO. ${pay}, emitido por banco de primer orden.`,
            `4. ENTREGA. ${incoterm} ${port} (Incoterms 2020), según calendario de embarques a acordar.`,
            `5. VALIDEZ. La presente oferta es válida por ${validity} días desde su emisión.`,
            ...(active.has("pop") ? [`6. PRUEBA DE PRODUCTO. ${fco.clauses[0].text}`] : []),
            ...(active.has("iccProcedure") ? [`7. PROCEDIMIENTO. ${fco.clauses[1].text}`] : []),
            `8. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [seller] },
      ],
    };
  },
};

/* ─────────────── IMFPA (Irrevocable Master Fee Protection Agreement) ─────────────── */
const imfpa: TemplateDef = {
  id: "imfpa",
  title: "Acuerdo Irrevocable de Protección de Comisiones (IMFPA)",
  shortTitle: "IMFPA",
  acronym: "IMFPA",
  category: "trade",
  summary:
    "Protege la comisión de los intermediarios/mandatarios: monto por MT o porcentaje, disparo del pago por embarque, coordenadas bancarias e irrevocabilidad.",
  fields: [
    {
      key: "payer",
      label: "Pagador (obligado al pago de la comisión)",
      type: "text",
      placeholder: "Vendedor o banco pagador",
    },
    {
      key: "beneficiary",
      label: "Beneficiario/s (intermediario/s)",
      type: "textarea",
      default: OWN_PARTY_LINE,
      help: "Uno por línea: razón social + país",
    },
    {
      key: "commodity",
      label: "Producto / operación",
      type: "text",
      placeholder: "Ej.: cátodo de cobre 99,99%",
    },
    {
      key: "feeType",
      label: "Base de la comisión",
      type: "select",
      default: "per_mt",
      options: [
        { value: "per_mt", label: "USD por tonelada (USD/MT)" },
        { value: "pct", label: "Porcentaje del valor bruto (%)" },
      ],
    },
    {
      key: "feeAmount",
      label: "Monto de la comisión (USD/MT o %)",
      type: "text",
      placeholder: "Ej.: USD 25/MT o 2%",
    },
    {
      key: "trigger",
      label: "Disparo del pago",
      type: "text",
      default: "Pro-rata, por cada embarque, simultáneo al pago del producto",
    },
    {
      key: "bankCoordinates",
      label: "Coordenadas bancarias del beneficiario",
      type: "textarea",
      placeholder: "Banco, SWIFT, IBAN/cuenta, titular",
    },
    { key: "termMonths", label: "Vigencia (meses)", type: "number", default: "60" },
    { key: "jurisdiction", label: "Jurisdicción", type: "text", default: "República de Chile" },
  ],
  clauses: [
    {
      key: "icc619",
      label: "Referencia a ICC 619 (protección de intermediarios)",
      defaultOn: true,
      text: "Las Partes reconocen la aplicación, en lo pertinente, de la guía ICC 619 sobre protección de comisiones de intermediarios en el comercio internacional.",
    },
    {
      key: "irrevocable",
      label: "Irrevocabilidad y transferencia bancaria directa",
      defaultOn: true,
      text: "El presente acuerdo es irrevocable e incondicional; el pagador instruye a su banco a transferir la comisión directamente al beneficiario, de forma simultánea a cada pago del producto.",
    },
  ],
  build: (val, active, ctx): GeneratedDoc => {
    const payer = bracket(gv(val, "payer"), "Pagador");
    const beneficiary = bracket(gv(val, "beneficiary"), "Beneficiario/s");
    const commodity = gv(val, "commodity", "[producto/operación]");
    const feeType = gv(val, "feeType", "per_mt");
    const fee = gv(val, "feeAmount", "[monto de comisión]");
    const trigger = gv(val, "trigger", "por cada embarque, simultáneo al pago del producto");
    const bank = gv(val, "bankCoordinates", "[coordenadas bancarias]");
    const term = gv(val, "termMonths", "60");
    const jur = gv(val, "jurisdiction", "República de Chile");
    const feeLabel = feeType === "pct" ? `${fee} del valor bruto` : `${fee}`;
    return {
      docType: "imfpa",
      reference: ctx.reference,
      date: ctx.date,
      title: "IRREVOCABLE MASTER FEE PROTECTION AGREEMENT (IMFPA)",
      blocks: [
        {
          kind: "paragraph",
          text: `${payer} (el "Pagador") reconoce y garantiza irrevocablemente el pago de la comisión de intermediación a ${beneficiary} (el/los "Beneficiario/s") en relación con la operación de ${commodity}.`,
        },
        {
          kind: "fields",
          rows: [
            ["Pagador", payer],
            ["Beneficiario/s", beneficiary],
            ["Operación", commodity],
            ["Comisión", feeLabel],
            ["Disparo del pago", trigger],
            ["Vigencia", `${term} meses`],
            ["Jurisdicción", jur],
          ],
        },
        {
          kind: "clauses",
          items: renumber([
            `1. COMISIÓN PROTEGIDA. El Pagador reconoce una comisión de ${feeLabel} a favor del/los Beneficiario/s por la operación de ${commodity}.`,
            `2. FORMA Y DISPARO DEL PAGO. La comisión se paga ${trigger}, mediante transferencia bancaria a las coordenadas indicadas.`,
            `3. COORDENADAS BANCARIAS. ${bank}.`,
            `4. VIGENCIA. ${term} meses, extensible automáticamente a operaciones recurrentes y renovaciones del contrato principal.`,
            ...(active.has("irrevocable") ? [`5. IRREVOCABILIDAD. ${imfpa.clauses[1].text}`] : []),
            ...(active.has("icc619") ? [`6. MARCO INTERNACIONAL. ${imfpa.clauses[0].text}`] : []),
            `7. NO ELUSIÓN. El Pagador se obliga a no eludir a los Beneficiarios en ésta ni en operaciones derivadas o repetitivas.`,
            `8. LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          ]),
        },
        { kind: "signature", parties: [payer, beneficiary] },
      ],
    };
  },
};
```

## Nota legal (obligatoria)

Estos tres son **borradores/esqueletos** con estructura y cláusulas estándar de
comercio internacional (ICC 619 / Incoterms 2020 / LC). **No** constituyen asesoría
legal ni están verificados por abogado. Antes de usarlos en una operación real, deben
revisarse y ajustarse a la jurisdicción y a la operación concreta — igual criterio que
los parámetros legales del catastro (`fecha_verificacion` pendiente).
