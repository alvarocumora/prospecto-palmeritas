import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScoreGauge } from "./ScoreGauge";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Check,
  AlertTriangle,
  X,
  Info,
  Sparkles,
} from "lucide-react";
import { verifyCommodityLot } from "@/lib/lotVerification.functions";
import type { FactorStatus, TrustLevel } from "@/lib/lotVerification";

const LEVEL_STYLE: Record<TrustLevel, { ring: string; text: string; icon: typeof ShieldCheck }> = {
  high: { ring: "text-emerald-600", text: "text-emerald-700", icon: ShieldCheck },
  medium: { ring: "text-amber-600", text: "text-amber-700", icon: ShieldAlert },
  low: { ring: "text-red-600", text: "text-red-700", icon: ShieldAlert },
};

const STATUS_ICON: Record<FactorStatus, { icon: typeof Check; className: string }> = {
  pass: { icon: Check, className: "text-emerald-600" },
  warn: { icon: AlertTriangle, className: "text-amber-600" },
  fail: { icon: X, className: "text-red-600" },
  info: { icon: Info, className: "text-content-subtle" },
};

/**
 * Panel del agente Know-Your-Mine: score de confianza del lote con evidencia
 * catastral-legal y dictamen de IA. Verificación pública y de solo lectura.
 */
export function LotTrustPanel({ lotId }: { lotId: string }) {
  const fn = useServerFn(verifyCommodityLot);
  const { data, isLoading } = useQuery({
    queryKey: ["lot-verification", lotId],
    queryFn: () => fn({ data: { lotId } }),
    staleTime: 10 * 60_000,
  });

  if (isLoading) {
    return <div className="h-40 rounded-xl border border-hairline bg-white animate-pulse" />;
  }
  if (!data) return null;

  const style = LEVEL_STYLE[data.level];
  const LevelIcon = style.icon;

  return (
    <section className="rounded-xl border border-hairline bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldQuestion className="w-4 h-4 text-accent-brand" />
        <h3 className="text-sm font-semibold tracking-tight">
          Verificación Know-Your-Mine
          <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-content-subtle">
            agente Geocapitals
          </span>
        </h3>
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        {/* Gauge */}
        <div className="flex items-center gap-4 shrink-0">
          <ScoreGauge score={data.score} ringClassName={style.ring} />
          <div>
            <div className={`inline-flex items-center gap-1.5 text-sm font-semibold ${style.text}`}>
              <LevelIcon className="w-4 h-4" /> {data.levelLabel}
            </div>
            {data.concessionCodes.length > 0 && (
              <div className="text-[11px] text-content-subtle mt-1">
                {data.concessionCodes.length} concesión(es) verificada(s)
              </div>
            )}
            {data.redFlags.length > 0 && (
              <div className="text-[11px] text-red-600 font-medium mt-1">
                {data.redFlags.length} bandera(s) roja(s)
              </div>
            )}
          </div>
        </div>

        {/* Factores */}
        <ul className="flex-1 space-y-1.5">
          {data.factors.map((f) => {
            const si = STATUS_ICON[f.status];
            const Icon = si.icon;
            return (
              <li key={f.key} className="flex items-start gap-2 text-[13px]">
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${si.className}`} />
                <span>
                  <span className="font-medium text-content">{f.label}: </span>
                  <span className="text-content-subtle">{f.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Dictamen IA */}
      {data.dictamen && (
        <div className="mt-4 rounded-lg border border-accent-brand/20 bg-accent-brand-subtle/40 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-accent-brand mb-1">
            <Sparkles className="w-3 h-3" /> Dictamen del analista IA
          </div>
          <p className="text-[13px] text-content leading-relaxed">{data.dictamen}</p>
        </div>
      )}

      <p className="mt-3 text-[10px] text-content-subtle leading-relaxed">
        Verificación automática contra SERNAGEOMIN, la nómina de remates de patentes y el Boletín
        Oficial de Minería. Es una señal de debida diligencia, no una garantía; confirma con la
        documentación del vendedor antes de operar.
      </p>
    </section>
  );
}
