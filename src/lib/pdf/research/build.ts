/** Client-side builder shared by the preview iframe and the test export. */
import { buildResearchDoc, type ResearchProject } from "./projects";
import type { ResearchDoc, ResearchFamily } from "./model";
import type { RenderReport } from "./render";

/** Experimental flag: only internal test exports, never public replacements. */
export const RESEARCH_DOCS_EXPERIMENTAL = true;

async function toDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve(undefined);
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export async function buildResearchPdf(model: ResearchDoc) {
  const { default: JsPDF } = await import("jspdf");
  const { ensureBrandFonts, ensureMonoFont } = await import("../brand/kit");
  const { renderResearchDoc } = await import("./render");
  const doc = new JsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  await ensureBrandFonts(doc);
  await ensureMonoFont(doc);
  if (model.map && !model.map.imageDataUrl)
    model.map.imageDataUrl = await toDataUrl(model.map.imageUrl);
  doc.setProperties({
    title: `${model.title} · ${model.projectName}`,
    subject: model.code,
    author: "GeoCapitals Research",
  });
  const report: RenderReport = renderResearchDoc(doc, model);
  return { doc, report };
}

export function researchFilename(m: ResearchDoc) {
  return `${m.code}_${m.version}_PRUEBA-INTERNA.pdf`;
}

export function getResearchModel(family: ResearchFamily, project: ResearchProject) {
  return buildResearchDoc(family, project);
}
