/**
 * Punto de entrada único de los documentos de proyecto de Geocapitals.
 * Un mismo modelo (`ProjectDoc`) se renderiza en las tres plantillas
 * globales de marca. Client-only: jsPDF se importa dinámicamente.
 */
import { GC_PAGE } from "./brand/tokens";
import { DOC_KIND_FILE, type ProjectDoc, type ProjectDocKind } from "./model";

/**
 * Las fuentes estándar de PDF sólo cubren WinAnsi: reemplazamos los símbolos
 * tipográficos que la aplicación usa en pantalla (flechas, ≈, ×, ≤) por
 * equivalentes imprimibles, para no mostrar glifos rotos en los documentos.
 */
const GLYPH_MAP: Array<[RegExp, string]> = [
  [/[→⟶➔]/g, "a"],
  [/[←]/g, "-"],
  [/[↑]/g, "N"],
  [/[↓]/g, "S"],
  [/≈/g, "aprox. "],
  [/≤/g, "<="],
  [/≥/g, ">="],
  [/[×✕]/g, "x"],
  [/[’‘]/g, "'"],
  [/[“”]/g, '"'],
  [/[•]/g, "-"],
];

function sanitizeGlyphs(value: string): string {
  return GLYPH_MAP.reduce((acc, [re, rep]) => acc.replace(re, rep), value);
}

/** Envuelve doc.text para sanear cualquier cadena antes de imprimirla. */
function guardText(doc: { text: (...args: never[]) => unknown }) {
  const original = doc.text.bind(doc);
  doc.text = ((...args: unknown[]) => {
    const [first, ...rest] = args;
    const clean =
      typeof first === "string"
        ? sanitizeGlyphs(first)
        : Array.isArray(first)
          ? first.map((v) => (typeof v === "string" ? sanitizeGlyphs(v) : v))
          : first;
    return original(...([clean, ...rest] as never[]));
  }) as typeof doc.text;
}

export async function buildProjectDoc(model: ProjectDoc, kind: ProjectDocKind) {
  const { default: JsPDF } = await import("jspdf");
  const { ensureBrandFonts } = await import("./brand/kit");

  if (kind === "deck") {
    const doc = new JsPDF({
      unit: "pt",
      format: [GC_PAGE.deck.w, GC_PAGE.deck.h],
      orientation: "landscape",
    });
    guardText(doc);
    await ensureBrandFonts(doc);
    const { renderInvestorDeck } = await import("./templates/investorDeck");
    await renderInvestorDeck(doc, model);
    return doc;
  }

  const doc = new JsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  guardText(doc);
  await ensureBrandFonts(doc);

  if (kind === "onepager") {
    const { renderOnePager } = await import("./templates/onePager");
    await renderOnePager(doc, model);
  } else {
    const { renderTechnicalBrief } = await import("./templates/technicalBrief");
    await renderTechnicalBrief(doc, model);
  }
  return doc;
}

export function projectDocFilename(model: ProjectDoc, kind: ProjectDocKind): string {
  const slug = model.code.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
  return `Geocapitals_${slug}_${DOC_KIND_FILE[kind]}_${model.docVersion}.pdf`;
}

/** Genera y descarga el documento en el navegador. */
export async function downloadProjectDoc(model: ProjectDoc, kind: ProjectDocKind): Promise<void> {
  const doc = await buildProjectDoc(model, kind);
  doc.save(projectDocFilename(model, kind));
}
