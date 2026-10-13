import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Satellite } from "lucide-react";
import { searchStac, type StacItem } from "@/lib/satelliteIntel.functions";
import { validSatelliteBbox } from "@/lib/satellite/evidence";

type Collection = "aster" | "emit" | "emitMinerals" | "hls" | "hlsLandsat" | "landsat";
type Props = { projectId: string; defaultBbox: [number, number, number, number] | null };
const COLLECTIONS: Array<{
  id: Collection;
  label: string;
  period: [string, string];
  detail: string;
}> = [
  {
    id: "hls",
    label: "HLS v2 S30 · Sentinel-2 armonizado · 30 m",
    period: ["2015-06-23", new Date().toISOString().slice(0, 10)],
    detail:
      "Reflectancia de superficie armonizada del instrumento Sentinel-2. Incluye capas de calidad; sirve para ampliar series temporales, pero esta búsqueda solo consulta metadatos.",
  },
  {
    id: "hlsLandsat",
    label: "HLS v2 L30 · Landsat 8/9 armonizado · 30 m",
    period: ["2013-04-11", new Date().toISOString().slice(0, 10)],
    detail:
      "Reflectancia de superficie Landsat 8/9 armonizada con Sentinel-2 a 30 m. Permite comparaciones temporales más consistentes; esta búsqueda no procesa bandas.",
  },
  {
    id: "landsat",
    label: "Landsat Collection 2 · Level-2",
    period: ["1982-08-22", new Date().toISOString().slice(0, 10)],
    detail:
      "Reflectancia de superficie Landsat Collection 2 Level-2, útil para contexto histórico multidecenal. La disponibilidad de bandas y sensores varía por escena.",
  },
  {
    id: "aster",
    label: "ASTER L2 surface reflectance v004 · VNIR/SWIR",
    period: ["2000-01-01", new Date().toISOString().slice(0, 10)],
    detail:
      "Reflectancia de superficie AST_07XT v004. Las bandas SWIR requieren máscara de calidad y credenciales Earthdata para leer los píxeles.",
  },
  {
    id: "emit",
    label: "EMIT L2A · reflectancia",
    period: ["2022-08-09", new Date().toISOString().slice(0, 10)],
    detail:
      "Reflectancia hiperespectral estimada por NASA, con incertidumbre y máscara como assets asociados.",
  },
  {
    id: "emitMinerals",
    label: "EMIT L2B · mineralogía estimada",
    period: ["2022-08-09", new Date().toISOString().slice(0, 10)],
    detail:
      "Producto NASA de minerales y profundidad de bandas; validar calidad, incertidumbre y geolocalización.",
  },
];

function publicBrowse(item: StacItem): string | null {
  try {
    const assets = JSON.parse(item.assetsJson) as Record<string, { href?: string }>;
    const candidate = assets.browse?.href ?? assets.thumbnail_0?.href;
    if (!candidate) return null;
    const url = new URL(candidate);
    return url.protocol === "https:" &&
      url.hostname === "data.lpdaac.earthdatacloud.nasa.gov" &&
      url.pathname.includes("/lp-prod-public/")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function publicStacHref(item: StacItem): string | null {
  try {
    const url = new URL(item.stacHref ?? "");
    return url.protocol === "https:" &&
      url.hostname === "cmr.earthdata.nasa.gov" &&
      url.pathname.startsWith("/stac/LPCLOUD/")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function RealMineralSceneCatalog({ projectId, defaultBbox }: Props) {
  const searchFn = useServerFn(searchStac);
  const [collection, setCollection] = useState<Collection>("emitMinerals");
  const [bboxText, setBboxText] = useState(defaultBbox?.join(", ") ?? "");
  const initialCollection = COLLECTIONS.find((source) => source.id === "emitMinerals")!;
  const [dateFrom, setDateFrom] = useState(initialCollection.period[0]);
  const [dateTo, setDateTo] = useState(initialCollection.period[1]);
  const [items, setItems] = useState<StacItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const bbox = bboxText.split(",").map((value) => (value.trim() ? Number(value) : NaN));
  const valid = validSatelliteBbox(bbox);
  const selected = COLLECTIONS.find((source) => source.id === collection)!;

  async function search() {
    if (inFlight.current || !valid || dateFrom > dateTo) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setItems([]);
    try {
      const result = await searchFn({
        data: { projectId, collection, bbox, dateFrom, dateTo, limit: 12 },
      });
      if (result.error) throw new Error(result.error);
      const dated = result.items.filter((item) => item.acquisitionDate);
      setItems(dated);
      if (!dated.length)
        setError(
          "El catálogo no devolvió escenas con fecha de adquisición para este AOI y periodo. No se generó ni interpretó ningún producto.",
        );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo consultar NASA CMR-STAC.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded border border-hairline bg-surface px-3 py-2 font-mono text-xs text-content";
  return (
    <section
      className="space-y-4 rounded-xl border border-hairline bg-surface p-4 md:p-6"
      aria-label="Catálogo de escenas satelitales"
    >
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 font-display text-xl text-content">
          <Satellite className="h-4 w-4 text-accent-brand" />
          Catálogo de escenas · Landsat, HLS, ASTER y EMIT
        </h2>
        <p className="text-xs text-content-subtle">
          Consulta escenas de Microsoft Planetary Computer y NASA para el AOI de {projectId}. El
          catálogo y las vistas previas son datos reales; una escena disponible no significa que sus
          píxeles se hayan procesado.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-content md:col-span-2">
          AOI WGS84 · oeste, sur, este, norte
          <input
            className={inputClass}
            value={bboxText}
            onChange={(event) => {
              setBboxText(event.target.value);
              setItems([]);
            }}
          />
        </label>
        <label className="text-xs text-content md:col-span-2">
          Sensor/producto
          <select
            className={inputClass}
            value={collection}
            disabled={busy}
            onChange={(event) => {
              const next = COLLECTIONS.find(
                (source) => source.id === (event.target.value as Collection),
              )!;
              setCollection(next.id);
              setDateFrom(next.period[0]);
              setDateTo(next.period[1]);
              setItems([]);
            }}
          >
            {COLLECTIONS.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-content">
          Desde
          <input
            className={inputClass}
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label className="text-xs text-content">
          Hasta
          <input
            className={inputClass}
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
      </div>
      <p className="text-xs text-content-subtle">
        {selected.detail} La imagen de vista previa es ilustrativa de la escena; no sustituye datos
        de píxel ni interpretación validada.
      </p>
      {!valid && (
        <p className="text-xs text-brand-danger">
          Ingresa un AOI geográfico válido de este proyecto.
        </p>
      )}
      <button
        type="button"
        disabled={!valid || busy || !dateFrom || !dateTo || dateFrom > dateTo}
        onClick={() => void search()}
        className="inline-flex items-center gap-2 rounded border border-accent-brand px-3 py-2 text-xs text-accent-brand disabled:opacity-50"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {busy ? "Consultando catálogo…" : "Buscar escenas reales"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-brand-danger">
          {error}
        </p>
      )}
      {items.length > 0 && (
        <p role="status" className="text-xs font-mono text-content">
          {items.length} escenas con fecha de adquisición · {selected.label}. No se han leído
          píxeles.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const browse = publicBrowse(item);
          const stac = publicStacHref(item);
          let assetNames: string[] = [];
          try {
            assetNames = Object.keys(JSON.parse(item.assetsJson) as Record<string, unknown>).filter(
              (name) => !name.startsWith("s3_"),
            );
          } catch {
            /* malformed optional metadata */
          }
          return (
            <article
              key={item.id}
              className="overflow-hidden rounded-lg border border-hairline bg-surface-2"
            >
              {browse && (
                <img
                  src={browse}
                  alt={`Vista de catálogo NASA para ${item.id}; no es resultado procesado`}
                  loading="lazy"
                  className="aspect-video w-full object-cover"
                />
              )}
              <div className="space-y-2 p-3 text-xs text-content">
                <p className="font-mono">
                  {item.acquisitionDate.slice(0, 10)} · {item.id}
                </p>
                <p className="text-content-subtle">
                  Nubosidad catalogada:{" "}
                  {item.cloudCover == null ? "no informada" : `${item.cloudCover}%`}
                </p>
                <p className="break-words text-content-subtle">
                  Assets: {assetNames.slice(0, 8).join(", ") || "metadatos del catálogo"}
                  {assetNames.length > 8 ? ` y ${assetNames.length - 8} más` : ""}
                </p>
                {stac && (
                  <a
                    href={stac}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-accent-brand underline"
                  >
                    Metadatos STAC
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="text-[11px] text-content-subtle">
        Descargas científicas L1T/NetCDF pueden requerir NASA Earthdata Login. Este panel no genera
        productos minerales, índices ni reportes a partir de escenas.
      </p>
    </section>
  );
}
