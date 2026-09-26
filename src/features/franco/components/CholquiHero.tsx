import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Download, ExternalLink, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProjectDocsMenu } from "@/components/documents/ProjectDocsMenu";
import { buildCholquiDoc } from "@/lib/pdf/adapters/cholqui";
import { publicUrl } from "@/lib/publicUrl";
import { CHOLQUI, CHOLQUI_ASSAYS, CHOLQUI_ASSAY_REPORTS, LAS_MINITAS } from "../data/cholqui";

type Props = {
  onDownload: () => void;
  downloading: boolean;
  onDownloadTeaser?: () => void;
  downloadingTeaser?: boolean;
};

export function CholquiHero({ onDownload, downloading }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const liveUrl = publicUrl(CHOLQUI.liveUrl);
  useEffect(() => {
    let active = true;
    void import("qrcode").then((mod) =>
      mod.toDataURL(liveUrl, { width: 320, margin: 1 }).then((value) => {
        if (active) setQr(value);
      }),
    );
    return () => {
      active = false;
    };
  }, [liveUrl]);

  const kpis: Array<[string, string]> = [
    ["Superficie", `~${CHOLQUI.areaHa.toLocaleString("es-CL")} ha`],
    ["Propiedad", `${CHOLQUI.pedimentos} pedimentos · ${CHOLQUI.pertenencias} pertenencias`],
    ["Commodity", CHOLQUI.commodity],
    ["Vecino en producción", `${LAS_MINITAS.throughputTMonth.toLocaleString("es-CL")} t/mes`],
  ];

  return (
    <section className="border border-hairline bg-white rounded-2xl overflow-hidden">
      <div className="bg-surface-inverse px-6 md:px-10 py-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_180px]">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-accent-brand-subtle">
            Geocapitals · Live map público · {CHOLQUI.code}
          </div>
          <h1 className="font-display text-4xl md:text-5xl mt-3 text-white">{CHOLQUI.name}</h1>
          <p className="mt-3 text-sm text-white/70 max-w-3xl">
            {CHOLQUI.commodity} · {CHOLQUI.stage} · Titular {CHOLQUI.operator}
          </p>
          <p className="mt-1 text-sm text-white/60 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" />
            {CHOLQUI.location}
          </p>
          <p className="mt-1 text-[12px] font-mono text-white/45">
            {CHOLQUI.center.lat}, {CHOLQUI.center.lng} · {CHOLQUI.crs}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <ProjectDocsMenu
              className="h-10 px-5"
              build={buildCholquiDoc}
              label="Descargar documentos"
            />
            <Button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              variant="outline"
              className="h-10 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Informe extendido
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <a
                href={`mailto:${CHOLQUI.contact.email}?subject=${encodeURIComponent(`${CHOLQUI.name} — interés de inversión`)}`}
              >
                <ExternalLink /> Contactar mesa de inversión
              </a>
            </Button>
          </div>
        </div>
        <aside className="self-end border border-primary-foreground/20 bg-primary-foreground/5 p-3">
          {qr ? (
            <img
              src={qr}
              alt="QR del Live Map público de Cholqui"
              className="w-full aspect-square bg-primary-foreground p-2"
            />
          ) : (
            <div className="aspect-square grid place-items-center">
              <Loader2 className="animate-spin text-primary-foreground" />
            </div>
          )}
          <div className="mt-3 text-[10px] font-mono uppercase text-primary-foreground/60">
            Enlace público verificable
          </div>
          <div className="mt-1 text-xs text-primary-foreground break-all">
            geocapitals.com/live/cholqui
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={() =>
              void navigator.clipboard
                .writeText(liveUrl)
                .then(() => toast.success("Enlace copiado"))
            }
          >
            <Copy /> Copiar enlace
          </Button>
        </aside>
      </div>

      <div className="grid gap-4 border-t border-hairline bg-surface px-5 py-4 md:grid-cols-[auto_1fr] md:items-center">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-content">
          <CheckCircle2 className="h-4 w-4 text-accent-brand" /> Evidencia química actualizada
        </div>
        <div className="text-xs text-content-subtle md:text-right">
          {CHOLQUI_ASSAYS.length} muestras · {CHOLQUI_ASSAY_REPORTS.length} informes · Andes
          Analytical + FGF Análisis Mineros
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-t border-hairline bg-surface-2">
        {kpis.map(([k, v]) => (
          <div key={k} className="px-5 py-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
              {k}
            </div>
            <div className="mt-1 text-sm font-medium text-content">{v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
