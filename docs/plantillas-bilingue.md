# Plantillas bilingües ES/EN — handoff a Lovable

> Los documentos de trade se envían a contrapartes internacionales, así que conviene
> generarlos **bilingües ES/EN**. La librería `src/lib/documents/templates.ts` es
> territorio Lovable; aquí va el **patrón recomendado** + un ejemplo completo (ICPO)
> para replicar en el resto.

## Patrón recomendado: `lang` en el render (mínimo cambio)

El `build()` de cada `TemplateDef` ya produce `DocBlock[]`. Para bilingüe, la opción
más limpia es **un parámetro de idioma** en el punto de render/generación, y strings
EN paralelos a los ES. Dos alternativas:

- **A) Documento bilingüe (ES sobre EN):** cada cláusula se emite como
  `"<texto ES>\n<texto EN>"`. Un solo PDF con ambos idiomas — lo más habitual en
  comercio internacional (evita ambigüedad de interpretación).
- **B) Selector de idioma:** `build(values, clauses, ctx, lang)` devuelve el doc en el
  idioma pedido; se genera un PDF ES y otro EN. Útil si la contraparte pide uno solo.

Recomendación: **A** para instrumentos que firman ambas partes (NCNDA, ICPO, FCO,
IMFPA, contrato de suministro); **B** para declaraciones internas del proveedor.

### Cambio de modelo sugerido (`model.ts`)

Agregar un campo opcional de traducción a las cláusulas y un helper de render:

```ts
// En ClauseDef, opcional:
export type ClauseDef = {
  key: string;
  label: string;
  text: string;
  textEn?: string;
  defaultOn?: boolean;
};

// Helper para emitir bilingüe (ES sobre EN) cuando lang === 'both':
export function biline(es: string, en: string, lang: "es" | "en" | "both" = "both"): string {
  if (lang === "es") return es;
  if (lang === "en") return en;
  return `${es}\n${en}`;
}
```

El editor/`documentos.index` puede exponer un toggle **ES / EN / Bilingüe** que pase
`lang` a `build()`.

## Ejemplo completo: ICPO bilingüe

Reemplaza el `build()` del `icpo` (de `docs/plantillas-trade-instruments.md`) por esta
versión con `lang` (por defecto `both`). Mismo patrón para FCO, IMFPA, NCNDA y contrato.

```ts
build: (val, active, ctx, lang: "es" | "en" | "both" = "both"): GeneratedDoc => {
  const buyer = bracket(gv(val, "buyer"), "Comprador");
  const seller = bracket(gv(val, "seller"), "Vendedor");
  const commodity = gv(val, "commodity", "[producto / product]");
  const qM = gv(val, "quantityMonthly", "[—]");
  const qT = gv(val, "quantityTotal", "[—]");
  const incoterm = gv(val, "incoterm", "CIF");
  const dest = gv(val, "destination", "[destino / destination]");
  const price = gv(val, "targetPrice", "[precio / price]");
  const pay = gv(val, "paymentInstrument", "DLC");
  const validity = gv(val, "validityDays", "10");
  const jur = gv(val, "jurisdiction", "República de Chile");
  return {
    docType: "icpo", reference: ctx.reference, date: ctx.date,
    title: "IRREVOCABLE CORPORATE PURCHASE ORDER (ICPO)",
    blocks: [
      { kind: "paragraph", text: biline(
        `${buyer} (el "Comprador") emite la presente Orden de Compra Corporativa Irrevocable a favor de ${seller} (el "Vendedor") para la adquisición de ${commodity}.`,
        `${buyer} (the "Buyer") hereby issues this Irrevocable Corporate Purchase Order in favor of ${seller} (the "Seller") for the purchase of ${commodity}.`,
        lang) },
      { kind: "fields", rows: [
        [biline("Comprador", "Buyer", lang), buyer],
        [biline("Vendedor", "Seller", lang), seller],
        [biline("Producto", "Product", lang), commodity],
        [biline("Cantidad mensual", "Monthly quantity", lang), `${qM} MT`],
        [biline("Cantidad total", "Total quantity", lang), `${qT} MT`],
        [biline("Incoterm 2020", "Incoterm 2020", lang), `${incoterm} ${dest}`],
        [biline("Precio objetivo", "Target price", lang), price],
        [biline("Instrumento de pago", "Payment instrument", lang), pay],
        [biline("Validez", "Validity", lang), `${validity} ${lang === "en" ? "days" : "días"}`],
        [biline("Jurisdicción", "Jurisdiction", lang), jur],
      ] },
      { kind: "clauses", items: renumber([
        biline(
          `OBJETO. El Comprador se compromete irrevocablemente a adquirir el producto y cantidades indicados, sujeto a la aceptación del Vendedor mediante su Oferta Corporativa (FCO) y a la firma del contrato definitivo.`,
          `PURPOSE. The Buyer irrevocably undertakes to purchase the product and quantities stated, subject to the Seller's acceptance via its Full Corporate Offer (FCO) and execution of the definitive contract.`, lang),
        biline(
          `PRECIO Y AJUSTE. El precio se establece en ${price}, sujeto al mecanismo de ajuste e inspección de calidad/cantidad en puerto.`,
          `PRICE & ADJUSTMENT. The price is set at ${price}, subject to the agreed adjustment mechanism and quality/quantity inspection at port.`, lang),
        biline(
          `PAGO. Mediante ${pay}, emitido por banco de primer orden contra documentos de embarque conformes.`,
          `PAYMENT. By ${pay}, issued by a first-class bank against conforming shipping documents.`, lang),
        biline(
          `INCOTERM. La entrega se pacta ${incoterm} ${dest} (Incoterms 2020).`,
          `INCOTERM. Delivery is agreed ${incoterm} ${dest} (Incoterms 2020).`, lang),
        biline(
          `VALIDEZ. La presente orden es válida por ${validity} días desde su emisión.`,
          `VALIDITY. This order is valid for ${validity} days from issuance.`, lang),
        biline(
          `LEY Y ARBITRAJE. ${jurisdictionClause(jur)}`,
          `GOVERNING LAW & ARBITRATION. This instrument is governed by the laws of ${jur} and disputes shall be submitted to arbitration; the Spanish version prevails in case of discrepancy.`, lang),
      ]) },
      { kind: "signature", parties: [buyer] },
    ],
  };
},
```

## Cláusula de prevalencia (importante en bilingüe)

En todo documento bilingüe, agregar que **una versión prevalece** ante discrepancia
(normalmente la del derecho aplicable). En el ejemplo, la cláusula de ley indica que
prevalece la versión en español. Ajustar según la operación.

## Alcance

- **Prioridad bilingüe (firman ambas partes):** NCNDA, ICPO, FCO, IMFPA, contrato de
  suministro, LOI, term sheet.
- **Declaraciones del proveedor / políticas:** bilingüe opcional (útil si la debida
  diligencia la revisa un comprador extranjero).
- El resto del catálogo (`docs/plantillas-catalogo-completo.md`) sigue el mismo patrón
  `biline()`.

## Nota legal

Las traducciones EN son de referencia operativa, **no** traducción jurada. Para uso
contractual real, validar con abogado y traductor certificado si la jurisdicción lo
exige.
