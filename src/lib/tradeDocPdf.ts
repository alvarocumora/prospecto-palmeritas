import type { GeneratedDoc } from "@/lib/tradeDocGen";
import { renderGeocapitalsPdf } from "@/lib/documents/pdf";

// Matriz única de diseño para TODOS los documentos generados en la plataforma.
// Antes existían dos renderers (uno "plano" con jsPDF para LOI/NCNDA/ICPO/SPA/
// Ficha desde Trade Desk y otro Institutional Modernist para NDAs). Eso
// producía PDFs con identidad distinta según el origen. Ahora este wrapper
// delega al renderer institucional (papel hueso · tinta · cobalto · QR de
// validación · header/footer de marca · watermark · sello CONFIDENCIAL · misma
// tabulación de fields/tables/clauses/signatures) para que cualquier PDF
// emitido por Geocapitals comparta exactamente el mismo modelo visual.
export async function renderTradeDocPdf(doc: GeneratedDoc): Promise<void> {
  // Los shapes de GeneratedDoc en tradeDocGen y documents/model son idénticos
  // (mismos kinds: paragraph · fields · table · clauses · signature).
  await renderGeocapitalsPdf(doc as unknown as import("@/lib/documents/model").GeneratedDoc);
}
