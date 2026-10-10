import { Link } from "@tanstack/react-router";
import { FlaskConical, FileSearch, ShieldCheck } from "lucide-react";
import { VERIFICATION_META, type VerificationLevel } from "@/lib/verification";

const STYLES: Record<VerificationLevel, string> = {
  pending: "text-slate-600 border-slate-400/40 bg-slate-100",
  demo: "text-amber-700 border-amber-500/40 bg-amber-500/10",
  traceable: "text-accent-brand border-accent-brand/40 bg-accent-brand-subtle/60",
  qp_verified: "text-emerald-700 border-emerald-500/40 bg-emerald-500/10",
};

const ICONS: Record<VerificationLevel, typeof FlaskConical> = {
  pending: FileSearch,
  demo: FlaskConical,
  traceable: FileSearch,
  qp_verified: ShieldCheck,
};

/**
 * Sello de origen de datos. Siempre visible donde se muestran datos de un
 * proyecto — la transparencia sobre qué es demo y qué es real es la primera
 * feature de confianza de la plataforma.
 */
export function VerificationBadge({
  level,
  compact = false,
  linked = true,
  className = "",
}: {
  level: VerificationLevel;
  /** Solo etiqueta corta (para cards densos). */
  compact?: boolean;
  /** Enlaza a /metodologia. */
  linked?: boolean;
  className?: string;
}) {
  const meta = VERIFICATION_META[level];
  const Icon = ICONS[level];
  const body = (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider whitespace-nowrap ${STYLES[level]} ${className}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      {compact ? meta.short : meta.label}
    </span>
  );
  if (!linked) return body;
  return (
    <Link
      to="/metodologia"
      className="hover:opacity-80 transition-opacity"
      title={meta.description}
    >
      {body}
    </Link>
  );
}
