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
  const liveUrl = publicUrl(CHOLQUI.liveUrl);
  const kpis: Array<[string, string]> = [
    ["Superficie", `~${CHOLQUI.areaHa.toLocaleString("es-CL")} ha`],
    ["Propiedad", `${CHOLQUI.pedimentos} pedimentos · ${CHOLQUI.pertenencias} pertenencias`],
    ["Commodity", CHOLQUI.commodity],
    ["Referencia distrital", `${LAS_MINITAS.throughputTMonth.toLocaleString("es-CL")} t/mes`],
  ];

  return (
    <section className="overflow-hidden rounded-brand-lg border border-hairline bg-surface-3">
      <div className="px-5 py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-brand">
              Proyecto minero · {CHOLQUI.code}
            </div>
            <h1 className="mt-2 font-serif text-4xl font-semibold leading-none tracking-[-0.025em] text-content md:text-5xl">
              {CHOLQUI.name}
            </h1>
            <p className="mt-3 text-sm text-content-muted">
              {CHOLQUI.commodity} · {CHOLQUI.stage} · Titular {CHOLQUI.operator}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-subtle">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {CHOLQUI.location}
              </span>
              <span className="font-mono">
                {CHOLQUI.center.lat}, {CHOLQUI.center.lng} · {CHOLQUI.crs}
              </span>
            </div>
          </div>

          <div className="flex max-w-xl flex-wrap gap-2">
            <ProjectDocsMenu className="h-9 px-4" build={buildCholquiDoc} label="Documentos" />
            <Button type="button" onClick={onDownload} disabled={downloading} variant="outline">
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Informe
            </Button>
            <Button asChild>
              <a
                href={`mailto:${CHOLQUI.contact.email}?subject=${encodeURIComponent(
                  `${CHOLQUI.name} — interés de inversión`,
                )}`}
              >
                <ExternalLink className="size-4" /> Contactar
              </a>
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-label="Copiar enlace público"
              onClick={() =>
                void navigator.clipboard
                  .writeText(liveUrl)
                  .then(() => toast.success("Enlace público copiado"))
              }
            >
              <Copy className="size-4" /> Compartir
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-hairline pt-4 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-content">
            <CheckCircle2 className="size-4 text-brand-success" />
            Evidencia química trazable
          </span>
          <span className="text-content-subtle">
            {CHOLQUI_ASSAYS.length} muestras · {CHOLQUI_ASSAY_REPORTS.length} informes · Andes
            Analytical + FGF Análisis Mineros
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-hairline bg-surface-2 md:grid-cols-4">
        {kpis.map(([key, value], index) => (
          <div
            key={key}
            className={`px-5 py-4 ${index % 2 ? "border-l border-hairline" : ""} md:border-l md:first:border-l-0`}
          >
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-content-subtle">
              {key}
            </div>
            <div className="mt-1 text-sm font-medium text-content">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
