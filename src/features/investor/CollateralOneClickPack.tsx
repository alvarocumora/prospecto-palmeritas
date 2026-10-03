import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { publicUrl } from "@/lib/publicUrl";
import { fmtClp } from "@/lib/investor/collateralProgram";

/** Un clic: simulación personalizada (PDF) + deck de inversión. */
export function CollateralOneClickPack({ amount, months }: { amount: number; months: number }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const [{ downloadCollateralSimulation }, { downloadCollateralDoc }] = await Promise.all([
        import("@/lib/investor/collateralSimulationPdf"),
        import("./collateralDownloads"),
      ]);
      await downloadCollateralSimulation(amount, months, publicUrl("/inversion-colateral"));
      await downloadCollateralDoc("deck");
      toast.success("Simulación y deck descargados");
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron generar los documentos. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 bg-content text-surface text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm hover:bg-accent-brand transition-colors disabled:opacity-60"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {busy ? "Generando documentos…" : `Descargar simulación ${fmtClp(amount)} + deck`}
    </button>
  );
}
