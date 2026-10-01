/**
 * Descarga pública del deck y teaser del programa de colateral.
 * Usa el motor único de informes Geocapitals (src/lib/pdf); todo se carga bajo demanda.
 */
import { buildCollateralDeck } from "@/lib/investor/collateralProgram";
import { publicUrl } from "@/lib/publicUrl";
import coverImg from "@/assets/colateral/cover-maule.jpg";
import hualanePlan from "@/assets/colateral/hualane-og.png";
import velValle from "@/assets/colateral/vel-valle.jpg";
import velLago from "@/assets/colateral/vel-lago.jpg";
import hualaneSat from "@/assets/colateral/hualane-satelite.jpg";
import velSat from "@/assets/colateral/vel-satelite.jpg";

async function toDataUrl(src: string, maxW = 1400): Promise<string | undefined> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } catch {
    return undefined;
  }
}

export async function downloadCollateralDoc(kind: "deck" | "teaser"): Promise<void> {
  const { downloadProjectDoc } = await import("@/lib/pdf/generateProjectDoc");
  const [cover, plan, ve, ve2, hs, vs] = await Promise.all(
    [coverImg, hualanePlan, velValle, velLago, hualaneSat, velSat].map((u) => toDataUrl(u)),
  );
  const model = {
    ...buildCollateralDeck({
      cover,
      hualanePlan: plan,
      valleEscondido: ve,
      valleEscondido2: ve2,
      hualaneSat: hs,
      valleEscondidoSat: vs,
    }),
    liveUrl: publicUrl("/inversion-colateral"),
  };
  if (kind === "teaser") {
    await downloadProjectDoc({ ...model, code: "GC-COLATERAL-TEASER" }, "onepager");
  } else {
    await downloadProjectDoc(model, "deck");
  }
}
