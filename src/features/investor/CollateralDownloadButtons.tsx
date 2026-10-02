import { useState } from "react";
import { FileDown, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

/** Botones públicos: teaser A4 (1 página, QR) y deck completo. Sin login. */
export function CollateralDownloadButtons({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState<null | "deck" | "teaser">(null);

  const run = async (kind: "deck" | "teaser") => {
    setBusy(kind);
    const id = toast.loading(kind === "teaser" ? "Generando teaser con QR…" : "Generando deck…");
    try {
      const { downloadCollateralDoc } = await import("./collateralDownloads");
      await downloadCollateralDoc(kind);
      toast.success("Descarga lista", { id });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el documento", { id });
    } finally {
      setBusy(null);
    }
  };

  const base =
    "inline-flex items-center gap-2 h-11 px-5 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-sm transition-colors disabled:opacity-60";
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => run("teaser")}
        disabled={busy !== null}
        className={`${base} border border-hairline text-content hover:border-accent-brand hover:text-accent-brand`}
      >
        {busy === "teaser" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <QrCode className="w-4 h-4" />
        )}
        Memorándum ejecutivo (PDF)
      </button>
      <button
        type="button"
        onClick={() => run("deck")}
        disabled={busy !== null}
        className={`${base} border border-hairline text-content hover:border-accent-brand hover:text-accent-brand`}
      >
        {busy === "deck" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileDown className="w-4 h-4" />
        )}
        Deck de inversión
      </button>
    </div>
  );
}
