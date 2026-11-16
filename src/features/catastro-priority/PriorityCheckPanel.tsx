import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sngmIdentify, SNGM_CONCESIONES_URL } from "@/lib/sngm";
import {
  evaluatePriority,
  LEVEL_LABEL,
  OJV_WINDOW_DAYS,
  BULLETIN_RADIUS_KM,
  type PriorityResult,
} from "@/lib/cadastre/priorityCheck";

function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const TONE: Record<string, string> = {
  ocupado: "border-destructive text-destructive",
  riesgo_ojv: "border-accent-brand text-accent-brand",
  condicionado: "border-im-gold text-im-gold",
  libre_indicativo: "border-hairline text-content",
};

export function PriorityCheckPanel({
  initialLat,
  initialLng,
}: { initialLat?: number; initialLng?: number } = {}) {
  const [lat, setLat] = useState(initialLat != null ? initialLat.toFixed(5) : "");
  const [lng, setLng] = useState(initialLng != null ? initialLng.toFixed(5) : "");
  const [comuna, setComuna] = useState("");
  const [own, setOwn] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<PriorityResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    const la = Number(lat.replace(",", "."));
    const ln = Number(lng.replace(",", "."));
    if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) {
      setErr("Ingresa latitud y longitud válidas (ej. -33.68, -71.21).");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const since = new Date(Date.now() - OJV_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
      const d = 0.06;
      const [sngmRaw, bRes, cRes] = await Promise.all([
        fetch(`${SNGM_CONCESIONES_URL}/query?f=json&where=1%3D0`)
          .then((r) => (r.ok ? sngmIdentify(SNGM_CONCESIONES_URL, ln, la) : undefined))
          .catch(() => undefined),
        supabase
          .from("mining_bulletins")
          .select("concession_name,publication_type,publication_date,centroid_lat,centroid_lng,source_url")
          .gte("centroid_lat", la - d)
          .lte("centroid_lat", la + d)
          .gte("centroid_lng", ln - d)
          .lte("centroid_lng", ln + d)
          .limit(200),
        comuna.trim()
          ? supabase
              .from("mining_court_cases")
              .select("case_number,court,matter,plaintiff,filed_at,source_url")
              .ilike("comuna", `%${comuna.trim()}%`)
              .gte("filed_at", since)
              .limit(200)
          : Promise.resolve({ data: [] as never[] }),
      ]);
      const sngm =
        sngmRaw === undefined
          ? null
          : {
              hit: !!sngmRaw,
              label: sngmRaw ? String(sngmRaw.NOMBRE ?? sngmRaw.nombre ?? "Concesión") : null,
            };
      setRes(
        evaluatePriority({
          today,
          ownFiledAt: own || null,
          sernageomin: sngm,
          bulletins: (bRes.data ?? []).map((b) => ({
            label: `${b.publication_type} · ${b.concession_name ?? "s/n"}`,
            publishedAt: b.publication_date,
            distanceKm:
              b.centroid_lat != null && b.centroid_lng != null
                ? km(la, ln, b.centroid_lat, b.centroid_lng)
                : null,
            insideGeometry: false,
            url: b.source_url,
          })),
          filings: (cRes.data ?? []).map((c) => ({
            label: `${c.case_number ?? "Rol s/n"} · ${c.court ?? ""} · ${c.plaintiff ?? ""}`,
            filedAt: c.filed_at,
            matter: c.matter,
            url: c.source_url,
          })),
        }),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo completar la revisión.");
    } finally {
      setBusy(false);
    }
  };

  const input = "rounded border border-hairline bg-surface px-2 py-1.5 text-sm";
  return (
    <div className="space-y-4 p-4">
      <div className="text-sm text-content-muted max-w-3xl">
        Cruza tres fuentes: SERNAGEOMIN (lo digitalizado), Boletín Oficial (lo publicado) y causas
        judiciales OJV (lo recién ingresado). La prioridad la define la{" "}
        <strong>fecha de ingreso judicial</strong>, no la publicación ni el mapa.
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">Latitud<br /><input className={input} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-33.68" /></label>
        <label className="text-xs">Longitud<br /><input className={input} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-71.21" /></label>
        <label className="text-xs">Comuna (tribunal)<br /><input className={input} value={comuna} onChange={(e) => setComuna(e.target.value)} placeholder="Melipilla" /></label>
        <label className="text-xs">Mi fecha de ingreso (opcional)<br /><input type="date" className={input} value={own} onChange={(e) => setOwn(e.target.value)} /></label>
        <button onClick={run} disabled={busy} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? "Revisando…" : "Revisar prioridad"}
        </button>
      </div>
      {err && <div className="text-sm text-destructive">{err}</div>}
      {res && (
        <div className="space-y-3">
          <div className={`inline-block rounded border-2 px-3 py-1.5 text-sm font-semibold ${TONE[res.level]}`}>
            {LEVEL_LABEL[res.level]}
          </div>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {res.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          {res.claims.length > 0 && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-content-muted border-b border-hairline">
                  <th className="py-1">Orden</th><th>Fuente</th><th>Solicitud</th><th>Ingreso judicial</th><th>Publicación</th><th>Distancia</th>
                </tr>
              </thead>
              <tbody>
                {res.claims.map((c, i) => (
                  <tr key={i} className={`border-b border-hairline ${res.senior.includes(c) ? "font-semibold" : ""}`}>
                    <td className="py-1">{i + 1}</td>
                    <td>{c.source === "ojv" ? "OJV" : c.source === "boletin" ? "Boletín" : "SERNAGEOMIN"}</td>
                    <td>{c.url ? <a className="underline" href={c.url} target="_blank" rel="noreferrer">{c.label}</a> : c.label}</td>
                    <td>{c.filedAt ?? "Por confirmar en juzgado"}</td>
                    <td>{c.publishedAt ?? "—"}</td>
                    <td>{c.distanceKm != null ? `${c.distanceKm.toFixed(1)} km` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-content-muted">
            Resultado indicativo. Publicaciones del Boletín se buscan por centroide a ≤ {BULLETIN_RADIUS_KM} km;
            causas OJV por comuna en los últimos {OJV_WINDOW_DAYS} días, según lo sincronizado en la plataforma.
            No reemplaza el estudio de títulos ni el certificado del juzgado.
          </p>
        </div>
      )}
    </div>
  );
}
