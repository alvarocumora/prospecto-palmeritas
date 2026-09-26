/**
 * Asset Card lateral: tabs Overview / Legal / Hydrology / Location /
 * Documents / Valuation. Nunca muestra como "Verified" un dato que sólo
 * está declarado en una ficha comercial.
 */
import { useState } from "react";
import { Download, FileText, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXERCISE_LABEL,
  NATURE_LABEL,
  QUALITY_STATUS_META,
  resolveQualityStatus,
  RIGHT_TYPE_LABEL,
  UNIT_VALUE_CLP,
  VALUATION_DISCLAIMER,
  VERIFICATION_META,
  fmtCLP,
  fmtCLPFull,
  fmtFlow,
  type WaterAsset,
  type WaterDocument,
  type WaterHydrology,
  type WaterLegalRecord,
  type WaterQualityTest,
} from "./data";
import { downloadWaterFicha } from "./waterFichaPdf";
import { WaterQualityPanel } from "./WaterQualityPanel";

const TABS = [
  "Overview",
  "Legal",
  "Hydrology",
  "Quality",
  "Location",
  "Documents",
  "Valuation",
] as const;
type Tab = (typeof TABS)[number];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <span className="text-[13px] text-slate-900 text-right max-w-[62%]">{value ?? "—"}</span>
    </div>
  );
}

function StatusChip({ verification }: { verification: string }) {
  const meta = VERIFICATION_META[verification] ?? VERIFICATION_META.pending;
  return (
    <span
      className={cn("inline-block rounded border px-2 py-0.5 text-[10px] font-medium", meta.tone)}
    >
      {meta.label}
    </span>
  );
}

export function WaterAssetCard({
  asset,
  legal,
  documents,
  quality,
  hydrology,
  mode,
  onClose,
  onRequestInfo,
}: {
  asset: WaterAsset;
  legal: WaterLegalRecord[];
  documents: WaterDocument[];
  quality: WaterQualityTest | null;
  hydrology: WaterHydrology | null;
  mode: "public" | "investor";
  onClose: () => void;
  onRequestInfo: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [busy, setBusy] = useState(false);

  const kpis: Array<[string, string]> = [
    ["FLOW", fmtFlow(asset.flow_permanent_ls)],
    ["TYPE", asset.nature === "consuntivo" ? "Consumptive" : "Non-consumptive"],
    ["SOURCE", RIGHT_TYPE_LABEL[asset.right_type] ?? asset.right_type],
    [
      "CAPTURE",
      asset.capture_system === "gravitacional" ? "Gravity" : (asset.capture_system ?? "—"),
    ],
    ["VALUE", fmtCLP(asset.reference_value_clp)],
    ["LOCATION", `${asset.commune} · ${asset.region}`],
  ];

  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <header className="border-b border-slate-200 bg-[#04122a] px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-[0.18em] text-sky-300">
              {asset.asset_id}
            </div>
            <h2 className="mt-1 text-lg font-semibold">{asset.river}</h2>
            <span className="mt-2 inline-block rounded border border-sky-400/50 bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-200">
              {EXERCISE_LABEL[asset.exercise] ?? asset.exercise}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-sky-200/70 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-px bg-slate-200">
        {kpis.map(([k, v]) => (
          <div key={k} className="bg-slate-50 px-3 py-2.5">
            <div className="text-[8.5px] uppercase tracking-[0.14em] text-slate-500">{k}</div>
            <div className="mt-0.5 text-[12px] font-semibold text-slate-900">{v}</div>
          </div>
        ))}
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              tab === t ? "bg-[#04122a] text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === "Overview" && (
          <div>
            {asset.summary && (
              <p className="mb-3 text-[13px] leading-relaxed text-slate-600">{asset.summary}</p>
            )}
            <Row label="Asset ID" value={asset.asset_id} />
            <Row label="Fuente hídrica" value={asset.river} />
            <Row label="Comuna" value={asset.commune} />
            <Row label="Provincia" value={asset.province} />
            <Row label="Región" value={asset.region} />
            <Row label="Naturaleza de la fuente" value={RIGHT_TYPE_LABEL[asset.right_type]} />
            <Row label="Tipo de derecho" value={NATURE_LABEL[asset.nature] ?? asset.nature} />
            <Row label="Ejercicio" value={EXERCISE_LABEL[asset.exercise] ?? asset.exercise} />
            <Row label="Caudal permanente" value={fmtFlow(asset.flow_permanent_ls)} />
            <Row
              label="Caudal eventual"
              value={
                asset.flow_eventual_ls ? `Hasta ${fmtFlow(asset.flow_eventual_ls)}` : "No informado"
              }
            />
            <Row
              label="Sistema de captación"
              value={
                asset.capture_system === "gravitacional" ? "Gravitacional" : asset.capture_system
              }
            />
            <Row
              label="Coordenadas"
              value={
                mode === "investor"
                  ? `${asset.latitude.toFixed(6)}, ${asset.longitude.toFixed(6)}`
                  : "Aproximadas (data room)"
              }
            />
            {asset.flow_notes && (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
                {asset.flow_notes}
              </p>
            )}
          </div>
        )}

        {tab === "Legal" && (
          <div>
            {mode === "public" || legal.length === 0 ? (
              <div className="rounded border border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-600">
                <Lock className="mb-2 h-4 w-4 text-slate-400" />
                La ficha jurídica completa (resoluciones, escrituras, inscripciones y titular
                registral) está disponible en el Investor Data Room con acceso autenticado.
              </div>
            ) : (
              <div className="space-y-2">
                {legal.map((r) => (
                  <div key={r.id} className="rounded border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] uppercase tracking-[0.1em] text-slate-500">
                        {r.attribute}
                      </span>
                      <StatusChip verification={r.verification} />
                    </div>
                    <div className="mt-1 text-[13px] text-slate-900">
                      {r.value ?? "No informado"}
                    </div>
                  </div>
                ))}
                <p className="pt-2 text-[11px] italic text-slate-500">
                  "Declared" = informado por el titular en ficha comercial. Sólo se marca "Verified"
                  con documento oficial validado por Geocapitals.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "Hydrology" && (
          <div>
            <Row label="Cuenca" value={hydrology?.basin ?? "Pendiente de carga"} />
            <Row label="Subcuenca" value={hydrology?.sub_basin ?? "Pendiente de carga"} />
            <Row label="Estación DGA" value={hydrology?.dga_station ?? "Pendiente de carga"} />
            <Row
              label="Caudal ecológico"
              value={
                hydrology?.ecological_flow_ls
                  ? fmtFlow(hydrology.ecological_flow_ls)
                  : "Pendiente de verificación"
              }
            />
            <Row
              label="Riesgo de sequía"
              value={hydrology?.drought_risk ?? "Sin dataset cargado"}
            />

            <h4 className="mt-5 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              Water Quality
            </h4>
            <div className="mt-2 rounded border border-slate-200 p-3">
              <div className="text-[13px] font-medium text-slate-900">
                {QUALITY_STATUS_META[resolveQualityStatus(asset, quality)].label}
              </div>
              <button
                type="button"
                onClick={() => setTab("Quality")}
                className="mt-1 text-[12px] font-medium text-sky-700 underline underline-offset-2"
              >
                Ver módulo Water Quality
              </button>
            </div>
          </div>
        )}

        {tab === "Quality" && (
          <WaterQualityPanel
            asset={asset}
            quality={quality}
            mode={mode}
            onRequestInfo={onRequestInfo}
          />
        )}

        {tab === "Location" && (
          <div>
            <Row label="País" value={asset.country} />
            <Row label="Región" value={asset.region} />
            <Row label="Provincia" value={asset.province} />
            <Row label="Comuna" value={asset.commune} />
            {mode === "investor" ? (
              <>
                <Row label="Latitud" value={asset.latitude.toFixed(6)} />
                <Row label="Longitud" value={asset.longitude.toFixed(6)} />
                <Row
                  label="Datum / Huso"
                  value={`${asset.utm_datum ?? "—"} · Huso ${asset.utm_zone ?? "—"}`}
                />
                <Row label="UTM Norte" value={asset.utm_north?.toLocaleString("es-CL") ?? "—"} />
                <Row label="UTM Este" value={asset.utm_east?.toLocaleString("es-CL") ?? "—"} />
              </>
            ) : (
              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-600">
                <Lock className="mb-2 h-4 w-4 text-slate-400" />
                Coordenadas UTM precisas y punto de captación disponibles en el Investor Data Room.
              </div>
            )}
          </div>
        )}

        {tab === "Documents" && (
          <div className="space-y-2">
            {documents.length === 0 ? (
              <div className="rounded border border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-600">
                Documentación en carga. Solicita acceso al data room para recibir resolución DGA,
                escritura pública, inscripción CBR y certificado de dominio vigente.
              </div>
            ) : (
              documents.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded border border-slate-200 p-3"
                >
                  <FileText className="h-4 w-4 shrink-0 text-sky-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-slate-900">{d.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {d.doc_type} · {d.institution ?? "—"} · {d.doc_date ?? "s/f"}
                    </div>
                  </div>
                  <StatusChip verification={d.status} />
                  {d.external_url && (
                    <a
                      href={d.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-sky-500"
                    >
                      View
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "Valuation" && (
          <div>
            <Row label="Permanent Flow" value={fmtFlow(asset.flow_permanent_ls)} />
            <Row
              label="Unit Value"
              value={`${fmtCLPFull(asset.unit_value_clp || UNIT_VALUE_CLP)} / L/s`}
            />
            <Row label="Reference Asset Value" value={fmtCLPFull(asset.reference_value_clp)} />
            <Row label="Caudal eventual" value="No valorizado" />
            <p className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-[11px] italic text-slate-600">
              {VALUATION_DISCLAIMER}
            </p>
          </div>
        )}
      </div>

      <footer className="border-t border-slate-200 p-4">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadWaterFicha(asset, mode === "investor" ? legal : [], { mode });
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded bg-[#04122a] px-3 py-2.5 text-[12px] font-medium text-white hover:bg-[#0a2450] disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {busy ? "Generando…" : "Descargar ficha PDF"}
          </button>
          <button
            type="button"
            onClick={onRequestInfo}
            className="rounded border border-slate-300 px-3 py-2.5 text-[12px] font-medium text-slate-700 hover:border-sky-500"
          >
            {mode === "investor" ? "Data room" : "Request Full Information"}
          </button>
        </div>
      </footer>
    </aside>
  );
}
