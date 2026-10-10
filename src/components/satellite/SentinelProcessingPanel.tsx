import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  getSentinelRasterDownload,
  listSentinelProcessingScenes,
  processSentinelScene,
} from "@/lib/sentinelProcessing.functions";
import { validSatelliteBbox } from "@/lib/satellite/evidence";

type Props = {
  projectId: string;
  slug?: string;
  defaultBbox?: [number, number, number, number] | null;
};
export function SentinelProcessingPanel({ projectId, slug, defaultBbox }: Props) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listSentinelProcessingScenes),
    processFn = useServerFn(processSentinelScene),
    downloadFn = useServerFn(getSentinelRasterDownload);
  const [bboxText, setBboxText] = useState(defaultBbox?.join(", ") ?? "");
  const [dateFrom, setDateFrom] = useState(() =>
    new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10),
  );
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [scenes, setScenes] = useState<
    Awaited<ReturnType<typeof listSentinelProcessingScenes>>["scenes"]
  >([]);
  const [sceneId, setSceneId] = useState("");
  const [busy, setBusy] = useState<"search" | "process" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const bbox = bboxText.split(",").map((value) => (value.trim() === "" ? NaN : Number(value)));
  const valid = validSatelliteBbox(bbox);
  const history = useQuery({
    queryKey: ["sentinel-real-runs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("satellite_analysis_runs")
        .select("id,status,external_scene_id,created_at,stats,content_hash,error_message")
        .eq("project_id", projectId)
        .eq("pipeline_version", "sentinel2-l2a-indices-v1")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
  async function search() {
    if (inFlight.current || !valid) return;
    inFlight.current = true;
    setBusy("search");
    setError(null);
    setScenes([]);
    setSceneId("");
    try {
      const result = await listFn({ data: { projectId, bbox, dateFrom, dateTo, maxCloud: 20 } });
      if (!result.ok) throw new Error(result.error ?? "No se pudo consultar el catálogo");
      setScenes(result.scenes);
      if (!result.scenes.length)
        setError("No hay escenas para este AOI y periodo. No se ejecutó procesamiento.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error consultando escenas");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  async function process() {
    if (inFlight.current || !valid || !sceneId) return;
    inFlight.current = true;
    setBusy("process");
    setError(null);
    try {
      const result = await processFn({ data: { projectId, bbox, sceneId } });
      if (!result.ok) throw new Error(result.error ?? "Procesamiento fallido");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error de procesamiento");
    } finally {
      await history.refetch();
      await queryClient.invalidateQueries({ queryKey: ["sentinel-real-preview", projectId] });
      inFlight.current = false;
      setBusy(null);
    }
  }
  async function download(runId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("download");
    setError(null);
    try {
      const { url } = await downloadFn({ data: { projectId, runId } });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Sentinel2_${runId}.tif`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Descarga no disponible");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  const inputClass =
    "w-full rounded border border-hairline bg-surface px-3 py-2 font-mono text-xs text-content";
  return (
    <section
      className="space-y-4 rounded-xl border border-hairline bg-surface p-4 md:p-6"
      aria-label="Procesamiento real Sentinel-2"
    >
      <header>
        <h2 className="font-display text-xl text-content">Procesamiento real · Sentinel-2 L2A</h2>
        <p className="mt-1 text-xs text-content-subtle">
          Reflectancia BOA y máscara SCL, alineadas a 20 m. NDVI, NDMI, B04/B02 y B11/B12 son
          índices derivados; no identifican minerales ni sustituyen análisis de campo.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-content md:col-span-2">
          AOI WGS84 · oeste, sur, este, norte
          <input
            className={inputClass}
            value={bboxText}
            disabled={busy !== null}
            onChange={(event) => {
              setBboxText(event.target.value);
              setScenes([]);
              setSceneId("");
            }}
          />
        </label>
        <label className="text-xs text-content">
          Desde
          <input
            className={inputClass}
            type="date"
            value={dateFrom}
            disabled={busy !== null}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setScenes([]);
              setSceneId("");
            }}
          />
        </label>
        <label className="text-xs text-content">
          Hasta
          <input
            className={inputClass}
            type="date"
            value={dateTo}
            disabled={busy !== null}
            onChange={(event) => {
              setDateTo(event.target.value);
              setScenes([]);
              setSceneId("");
            }}
          />
        </label>
      </div>
      {!valid && (
        <p className="text-xs text-brand-danger">
          Define un AOI válido del proyecto. No se usarán coordenadas de otro activo.
        </p>
      )}
      <p className="text-xs text-content-subtle">
        Máximo un millón de celdas a 20 m. Consulta hasta 12 escenas con nubes inferiores al 20 %;
        la máscara local determina los píxeles válidos.
      </p>
      <button
        type="button"
        className="rounded border border-accent-brand px-3 py-2 text-xs text-accent-brand disabled:opacity-50"
        disabled={!valid || busy !== null || !dateFrom || !dateTo || dateFrom > dateTo}
        onClick={() => void search()}
      >
        Buscar escenas Sentinel-2
      </button>
      {scenes.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-xs text-content">
            Escena a procesar
            <select
              className={inputClass}
              value={sceneId}
              disabled={busy !== null}
              onChange={(event) => setSceneId(event.target.value)}
            >
              <option value="">Selecciona una escena</option>
              {scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.datetime.slice(0, 10)} · nubes {scene.cloudPct ?? "—"}% · {scene.id}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded border border-accent-brand px-3 py-2 text-xs text-accent-brand disabled:opacity-50"
            disabled={!sceneId || !valid || busy !== null}
            onClick={() => void process()}
          >
            Procesar reflectancia real
          </button>
        </div>
      )}
      {busy && (
        <p role="status" className="text-xs text-content">
          {busy === "process"
            ? "Procesando bandas reales, máscara y GeoTIFF…"
            : busy === "search"
              ? "Consultando catálogo de escenas…"
              : "Preparando descarga privada…"}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-brand-danger">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <h3 className="text-xs font-mono text-content">Corridas del proyecto</h3>
        {history.isPending && (
          <p role="status" className="text-xs text-content-subtle">
            Cargando corridas…
          </p>
        )}
        {history.isError && (
          <p role="alert" className="text-xs text-brand-danger">
            No se pudieron consultar las corridas.{" "}
            <button type="button" onClick={() => void history.refetch()}>
              Reintentar
            </button>
          </p>
        )}
        {history.data?.length === 0 && (
          <p className="text-xs text-content-subtle">
            No hay corridas de procesamiento real registradas.
          </p>
        )}
        {history.data?.map((run) => {
          const stats =
            run.stats && typeof run.stats === "object" && !Array.isArray(run.stats)
              ? run.stats
              : null;
          const indices =
            stats?.indices && typeof stats.indices === "object" && !Array.isArray(stats.indices)
              ? stats.indices
              : null;
          return (
            <article
              key={run.id}
              className="rounded border border-hairline p-3 text-xs text-content"
            >
              <p className="break-all font-mono">
                {run.external_scene_id} · {run.status}
              </p>
              {run.status === "succeeded" && (
                <>
                  <p className="mt-1">
                    MODELADO · índices calculados de reflectancia real ·{" "}
                    {String(stats?.valid_pixels ?? "—")} píxeles válidos /{" "}
                    {String(stats?.excluded_pixels ?? "—")} excluidos
                  </p>
                  {indices && (
                    <dl className="mt-2 flex flex-wrap gap-4 font-mono">
                      {Object.entries(indices).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>
                            {value &&
                            typeof value === "object" &&
                            !Array.isArray(value) &&
                            typeof value.mean === "number"
                              ? value.mean.toFixed(4)
                              : "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p className="mt-2 break-all font-mono text-content-subtle">
                    SHA-256 {run.content_hash}
                  </p>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void download(run.id)}
                    className="mt-2 text-accent-brand hover:underline"
                  >
                    Descargar GeoTIFF · 4 bandas
                  </button>
                  {slug && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      <Link
                        to="/terminal/$slug"
                        params={{ slug }}
                        search={{ tab: "mapa", view: "2d" }}
                        className="text-accent-brand hover:underline"
                      >
                        Abrir mapa 2D
                      </Link>
                      <Link
                        to="/terminal/$slug"
                        params={{ slug }}
                        search={{ tab: "mapa", view: "3d" }}
                        className="text-accent-brand hover:underline"
                      >
                        Abrir mapa 3D
                      </Link>
                    </div>
                  )}
                </>
              )}
              {run.status === "failed" && (
                <p role="alert" className="mt-1 text-brand-danger">
                  {run.error_message}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
