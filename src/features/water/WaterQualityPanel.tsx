/**
 * Water Quality — módulo de estado analítico por activo.
 *
 * Estados soportados (jerarquía de evidencia):
 *  1. Not Tested                     — sin muestreo registrado
 *  2. Historical Analysis Available  — análisis previos aportados por el titular
 *  3. Laboratory Verified            — laboratorio acreditado + certificado validado
 *  4. Pending Verification           — documentación entregada, en revisión Geocapitals
 *
 * Cuando existen parámetros se muestran contra los límites de referencia
 * NCh 409/1 (agua potable) y NCh 1333 (riego). Nunca se declara "Verified"
 * sin certificado de laboratorio validado.
 */
import { AlertCircle, Beaker, CheckCircle2, FlaskConical, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  QUALITY_PARAM_META,
  QUALITY_STATUS_META,
  resolveQualityStatus,
  type WaterAsset,
  type WaterQualityTest,
} from "./data";

const ICONS = {
  not_tested: Beaker,
  historical: FlaskConical,
  lab_verified: CheckCircle2,
  pending_verification: Hourglass,
} as const;

export function WaterQualityPanel({
  asset,
  quality,
  mode,
  onRequestInfo,
}: {
  asset: WaterAsset;
  quality: WaterQualityTest | null;
  mode: "public" | "investor";
  onRequestInfo?: () => void;
}) {
  const statusKey = resolveQualityStatus(asset, quality);
  const meta = QUALITY_STATUS_META[statusKey];
  const Icon = ICONS[statusKey as keyof typeof ICONS] ?? Beaker;
  const params = Object.entries(quality?.parameters ?? {});

  return (
    <div className="space-y-4">
      <div className={cn("rounded border p-4", meta.tone)}>
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="text-[13px] font-semibold">{meta.label}</div>
            <p className="mt-1 text-[12px] leading-relaxed opacity-90">{meta.description}</p>
          </div>
        </div>
      </div>

      <dl className="rounded border border-slate-200">
        {[
          ["Fecha de muestreo", quality?.sampling_date ?? "Sin muestreo registrado"],
          ["Laboratorio", quality?.laboratory ?? "No informado"],
          ["Acreditación", quality?.certification ?? "No informada"],
          ["Parámetros registrados", params.length ? String(params.length) : "0"],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-4 border-b border-slate-100 px-3 py-2 last:border-0"
          >
            <dt className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{k}</dt>
            <dd className="text-right text-[12.5px] text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      {params.length > 0 ? (
        <div className="overflow-hidden rounded border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
                <th className="px-3 py-2 font-medium">Parámetro</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {params.map(([key, value]) => {
                const pm = QUALITY_PARAM_META[key.toLowerCase()];
                return (
                  <tr key={key} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-[12.5px] text-slate-900">{pm?.label ?? key}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] text-slate-900">
                      {String(value)}
                      {pm?.unit ? ` ${pm.unit}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right text-[11px] text-slate-500">
                      {pm?.reference ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-2 text-[12px] text-slate-600">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p>
              Water quality documentation pending verification. No existen parámetros
              físico-químicos ni microbiológicos cargados para {asset.asset_id}. El muestreo se
              coordina con laboratorio acreditado durante la due diligence técnica.
            </p>
          </div>
          {onRequestInfo && (
            <button
              type="button"
              onClick={onRequestInfo}
              className="mt-3 rounded bg-[#04122a] px-3 py-1.5 text-[11.5px] font-medium text-white"
            >
              {mode === "public"
                ? "Solicitar plan de muestreo"
                : "Solicitar análisis de laboratorio"}
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] italic leading-relaxed text-slate-500">
        Referencias: NCh 409/1 (agua potable) y NCh 1333 (agua para riego). Los resultados
        históricos aportados por el titular se clasifican como "Historical Analysis Available" hasta
        contar con certificado de laboratorio acreditado validado por Geocapitals.
      </p>
    </div>
  );
}
