import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CircleAlert,
  Database,
  FileClock,
  FileSignature,
  Fingerprint,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useReportGovernance } from "@/hooks/useReportGovernance";

function shortHash(value: string | null | undefined): string {
  if (!value) return "Sin snapshot";
  return value.length <= 16 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function ReportingGovernancePanel() {
  const { readiness, latestReport, reviewer, versions, gate, loading, error } =
    useReportGovernance();

  const latestVersion = versions[0] ?? null;
  const standards = latestReport?.active_standards ?? [];

  return (
    <section className="overflow-hidden rounded-brand-lg border border-hairline bg-surface-3">
      <header className="flex flex-col gap-3 border-b border-hairline px-5 py-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-brand">
            <ShieldCheck className="h-4 w-4" />
            Readiness · Governance · QP/CP
          </div>
          <h2 className="mt-1 text-xl font-semibold text-content">{gate.label}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-content-muted">{gate.detail}</p>
        </div>
        <span className="w-fit rounded-full border border-hairline bg-surface-2 px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-content-subtle">
          {loading ? "evaluando" : gate.status.replaceAll("_", " ")}
        </span>
      </header>

      {error ? (
        <div className="flex items-start gap-2 border-b border-hairline px-5 py-3 text-xs text-content-muted">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          No fue posible completar todos los gates: {error}
        </div>
      ) : null}

      <div className="grid md:grid-cols-3 lg:grid-cols-6">
        <GateCard
          icon={Database}
          label="Procedencia"
          value={readiness?.overall.level ?? "sin lectura"}
          detail={
            readiness
              ? `${readiness.geochem.measured} muestras medidas · ${readiness.geophysics.realStations} estaciones geofísicas reales`
              : "report_readiness pendiente"
          }
          ready={gate.dataReady}
        />
        <GateCard
          icon={FileClock}
          label="Reporte"
          value={latestReport ? `v${latestReport.version} · ${latestReport.status}` : "sin reporte"}
          detail={latestReport?.title ?? "Crea un technical report controlado"}
          ready={Boolean(latestReport)}
        />
        <GateCard
          icon={UserCheck}
          label="QP / CP"
          value={reviewer?.full_name ?? "no asignado"}
          detail={
            standards.length
              ? `${standards.join(", ")} · ${reviewer?.is_verified ? "verificado" : "pendiente"}`
              : "Sin estándar activo"
          }
          ready={gate.reviewerReady}
        />
        <GateCard
          icon={FileSignature}
          label="Secciones"
          value={`${gate.signedRequiredSections}/${gate.requiredSections}`}
          detail="Secciones con revisión competente requerida y firma registrada"
          ready={gate.sectionsReady}
        />
        <GateCard
          icon={BadgeCheck}
          label="Checklist"
          value={
            latestReport?.compliance_score_cached != null
              ? `${latestReport.compliance_score_cached}%`
              : "sin evaluar"
          }
          detail={
            latestReport
              ? `Umbral interno: ${latestReport.compliance_threshold ?? 95}%`
              : "No hay reporte seleccionado"
          }
          ready={gate.complianceReady}
        />
        <GateCard
          icon={Fingerprint}
          label="Versión"
          value={latestVersion ? `v${latestVersion.versionNo}` : "sin snapshot"}
          detail={shortHash(latestVersion?.hashSha256)}
          ready={gate.snapshotReady}
        />
      </div>

      <div className="grid gap-3 border-t border-hairline bg-surface-2 p-4 md:grid-cols-3">
        <Link
          to="/dashboard/ni43101"
          className="rounded-brand border border-hairline bg-surface-3 px-4 py-3 text-xs text-content hover:border-accent-brand/50"
        >
          <span className="font-medium">Abrir workspace técnico</span>
          <span className="mt-1 block text-content-subtle">QP, secciones, firma y compliance.</span>
        </Link>
        <Link
          to="/dashboard/validation"
          className="rounded-brand border border-hairline bg-surface-3 px-4 py-3 text-xs text-content hover:border-accent-brand/50"
        >
          <span className="font-medium">Revisar procedencia</span>
          <span className="mt-1 block text-content-subtle">Datasets, validación y gaps.</span>
        </Link>
        <div className="rounded-brand border border-hairline bg-surface-3 px-4 py-3 text-xs text-content-subtle">
          <span className="font-medium text-content">Control de emisión</span>
          <span className="mt-1 block">
            “Candidato a emisión controlada” es un gate interno; no certifica cumplimiento NI
            43-101/JORC ni reemplaza al QP/CP.
          </span>
        </div>
      </div>
    </section>
  );
}

function GateCard({
  icon: Icon,
  label,
  value,
  detail,
  ready,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="border-b border-hairline px-4 py-4 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-content-subtle" />
        <span className="font-mono text-[9px] uppercase tracking-wider text-content-subtle">
          {label}
        </span>
      </div>
      <div className="mt-2 text-sm font-semibold text-content">{value}</div>
      <div className="mt-1 text-[11px] leading-snug text-content-subtle">{detail}</div>
      <div className="mt-2 font-mono text-[9px] uppercase tracking-wider text-content-subtle">
        {ready ? "gate ready" : "gate pendiente"}
      </div>
    </div>
  );
}
