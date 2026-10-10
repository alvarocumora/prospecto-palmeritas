/** Legacy download names delegate to the shared institutional PDF renderer. */
import { publicUrl } from "@/lib/publicUrl";
import { CHOLQUI } from "./data/cholqui";
import { captureElement } from "@/lib/pdf/captureMap";
import { downloadProjectDoc } from "@/lib/pdf/generateProjectDoc";
import {
  buildCholquiInvestmentDoc,
  CHOLQUI_INVESTMENT_VERSION,
  CHOLQUI_INVESTMENT_TEASER_VERSION,
} from "@/lib/pdf/adapters/cholquiInvestment";

export const CHOLQUI_LIVE_URL = publicUrl(CHOLQUI.liveUrl);
export const CHOLQUI_DOC_VERSION = CHOLQUI_INVESTMENT_VERSION;
export const CHOLQUI_TEASER_VERSION = CHOLQUI_INVESTMENT_TEASER_VERSION;

export async function downloadCholquiInvestmentPdf(
  kind: "brief" | "teaser" = "brief",
): Promise<void> {
  const model = buildCholquiInvestmentDoc(kind === "teaser");
  if (model.map?.captureSelector && kind !== "teaser") {
    const image = await captureElement(model.map.captureSelector, { scale: 2 });
    if (image) model.map.imageDataUrl = image;
  }
  await downloadProjectDoc(model, kind === "teaser" ? "onepager" : "technical");
}

export async function downloadCholquiInvestmentTeaserPdf(): Promise<void> {
  return downloadCholquiInvestmentPdf("teaser");
}
