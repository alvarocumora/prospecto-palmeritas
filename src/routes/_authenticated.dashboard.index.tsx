import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  Banknote,
  Handshake,
  Ship,
  FileSignature,
  MessageSquare,
  Package,
  PackageSearch,
  Plus,
  ArrowRight,
  AlertTriangle,
  Users,
  FolderKanban,
  Compass,
  FileText,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useMyModules, type ModuleInfo } from "@/hooks/useMyModules";
import { OnboardingWizard } from "@/features/onboarding/OnboardingWizard";
import { InvestorHome } from "@/features/home/InvestorHome";
import { ActiveProjectCard } from "@/features/home/ActiveProjectCard";
import { RoleQuickStart } from "@/features/home/RoleQuickStart";
import { getBusinessOverview } from "@/lib/businessOverview.functions";
import { SHIPMENT_STATUS_LABELS } from "@/lib/shipments";
import { normalizeEvent } from "@/lib/tradeTimeline";
import { KpiTile } from "@/components/ui-system";
import { cn } from "@/lib/utils";

// INICIO = Centro de Negocios: cierres, clientes, pedidos de commodities,
// firmas y envíos — datos reales del usuario, cross-proyecto. La visión
// técnica del proyecto activo vive en /dashboard/mission.

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Centro de Negocios — Geocapitals" }] }),
  validateSearch: (s: Record<string, unknown>): { locked?: string } =>
    typeof s.locked === "string" ? { locked: s.locked } : {},

  component: BusinessHome,
});

const STAGE_CHIP: Record<string, string> = {
  icpo: "ICPO",
  fco: "FCO",
  spa: "SPA",
  payment: "Pago",
  shipping: "Embarque",
  delivered: "Entregado",
  closed: "Cerrado",
};

const fmtUsd = (n: number) =>
  n >= 1_000_000
    ? `US$ ${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`
    : `US$ ${Math.round(n).toLocaleString("es-CL")}`;

function formatName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toLocaleUpperCase("es-CL") + part.slice(1))
    .join(" ");
}

function BusinessHome() {
  const { profile, user } = useAuth();
  const { projects, active } = useProjects();
  const { isComplete: onboardingComplete, refresh: refreshOnboarding } = useOnboardingStatus();
  const { locked } = Route.useSearch();
  const { data: myModules } = useMyModules();
  const locale: "es" | "en" =
    (profile as { language?: string } | null)?.language === "en" ? "en" : "es";
  const name = formatName(profile?.display_name ?? user?.email?.split("@")[0] ?? "");
  const needsOnboarding = !profile?.account_type || !onboardingComplete;
  const isInvestor = profile?.account_type === "investor";

  const fn = useServerFn(getBusinessOverview);
  const { data: ov, isLoading } = useQuery({
    queryKey: ["business-overview", user?.id],
    enabled: !!user && !isInvestor,
    queryFn: () => fn(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isInvestor)
    return (
      <InvestorHome name={name}>
        {needsOnboarding && <OnboardingWizard onComplete={refreshOnboarding} />}
      </InvestorHome>
    );

  return (
    <div data-theme="im-light" className="min-h-full bg-background text-foreground">
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto pb-20 md:pb-8 space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
              Centro de Negocios
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mt-1">Hola{name ? `, ${name}` : ""}.</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Deals, commodities, firmas y envíos — tu operación completa en una pantalla.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/dashboard/trades"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Nuevo trade
            </Link>
            <Link
              to="/dashboard/documentos"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-sm hover:bg-accent"
            >
              <FileSignature className="w-4 h-4" /> Enviar NDA
            </Link>
          </div>
        </header>

        {locked && (
          <div className="rounded-md border border-signal-amber/50 bg-signal-amber/10 px-3 py-2 text-xs text-signal-amber">
            {locale === "es"
              ? `El módulo "${locked}" no está incluido en tu plan actual. Contacta a Geocapitals para habilitarlo.`
              : `The "${locked}" module is not included in your current plan. Contact Geocapitals to enable it.`}
          </div>
        )}

        <ActiveProjectCard project={active} />
        <RoleQuickStart />

        {myModules && myModules.modules.length > 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {myModules.modules.map((m: ModuleInfo) => (
              <Link
                key={m.key}
                to={
                  m.key === "commodities"
                    ? "/dashboard/trades"
                    : m.key === "capital"
                      ? "/dashboard/deals"
                      : "/dashboard/projects"
                }
                className="rounded-md border border-border bg-bg-secondary/30 p-3 hover:border-primary/60 hover:bg-accent/40 transition-colors"
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {locale === "es" ? "Módulo" : "Module"}
                </div>
                <div className="text-sm font-semibold mt-0.5">
                  {locale === "es" ? m.name_es : m.name_en}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {locale === "es" ? m.description_es : m.description_en}
                </div>
              </Link>
            ))}
          </div>
        )}

        {needsOnboarding && (
          <details className="rounded-xl border border-hairline bg-surface">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-content">
              <span className="mr-2 rounded-full bg-accent-brand-subtle px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-accent-brand">
                Perfil
              </span>
              Completa la configuración de tu cuenta
            </summary>
            <div className="border-t border-hairline p-3 md:p-4">
              <OnboardingWizard onComplete={refreshOnboarding} />
            </div>
          </details>
        )}

        {/* KPIs del negocio */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi
            icon={<Briefcase className="w-4 h-4" />}
            label="Pipeline activo"
            value={isLoading ? "…" : fmtUsd(ov?.trades.pipelineUsd ?? 0)}
            hint={`${ov?.trades.active ?? 0} operaciones en curso · ${ov?.trades.closed ?? 0} cerradas`}
            to="/dashboard/trades"
          />
          <Kpi
            icon={<Banknote className="w-4 h-4" />}
            label="Por cobrar"
            value={isLoading ? "…" : fmtUsd(ov?.finance.outstandingUsd ?? 0)}
            hint={
              (ov?.finance.overdueUsd ?? 0) > 0
                ? `⚠ ${fmtUsd(ov!.finance.overdueUsd)} vencido · ${fmtUsd(ov?.finance.receivedUsd ?? 0)} cobrado`
                : `${fmtUsd(ov?.finance.receivedUsd ?? 0)} cobrado`
            }
            to="/dashboard/trades"
            warn={(ov?.finance.overdueUsd ?? 0) > 0}
          />
          <Kpi
            icon={<Ship className="w-4 h-4" />}
            label="Envíos en curso"
            value={isLoading ? "…" : String(ov?.shipments.active ?? 0)}
            hint={
              (ov?.shipments.delayed ?? 0) > 0
                ? `⚠ ${ov!.shipments.delayed} atrasado(s)`
                : "todo en plazo"
            }
            to="/dashboard/envios"
            warn={(ov?.shipments.delayed ?? 0) > 0}
          />
          <Kpi
            icon={<FileSignature className="w-4 h-4" />}
            label="Firmas pendientes"
            value={isLoading ? "…" : String(ov?.signs.pending ?? 0)}
            hint={`${ov?.signs.signed ?? 0} documentos firmados`}
            to="/dashboard/documentos"
          />
          <Kpi
            icon={<MessageSquare className="w-4 h-4" />}
            label="Cotizaciones"
            value={
              isLoading ? "…" : String((ov?.inquiries.received ?? 0) + (ov?.inquiries.sent ?? 0))
            }
            hint={`${ov?.inquiries.received ?? 0} recibidas · ${ov?.inquiries.sent ?? 0} enviadas`}
            to="/dashboard/my-inquiries"
          />
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
          {/* Columna principal: operaciones y envíos */}
          <div className="space-y-4">
            {/* Operaciones en curso */}
            <section className="rounded-md border border-border bg-bg-secondary/20">
              <SectionHead
                icon={<Handshake className="w-4 h-4 text-primary" />}
                title="Operaciones en curso"
                to="/dashboard/trades"
                cta="Trade Desk"
              />
              {isLoading ? (
                <div className="p-4 h-24 animate-pulse" />
              ) : (ov?.trades.recent.length ?? 0) === 0 ? (
                <Empty text="Sin operaciones activas. Crea un trade desde el Trade Desk o desde una cotización del marketplace." />
              ) : (
                <ul className="divide-y divide-border">
                  {ov!.trades.recent.map((t) => (
                    <li key={t.id}>
                      <Link
                        to="/dashboard/trades/$tradeId"
                        params={{ tradeId: t.id }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
                      >
                        <span className="font-mono text-sm font-semibold shrink-0">
                          {t.reference ?? t.id.slice(0, 8)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {t.commodity ?? "—"}
                          {t.quantity_t ? ` · ${t.quantity_t} t` : ""} ·{" "}
                          {t.role === "buyer" ? "compra" : "venta"}
                        </span>
                        <span className="ml-auto flex items-center gap-2 shrink-0">
                          {t.total_value_usd ? (
                            <span className="font-mono text-xs">{fmtUsd(t.total_value_usd)}</span>
                          ) : null}
                          <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                            {STAGE_CHIP[t.stage] ?? t.stage}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Envíos */}
            <section className="rounded-md border border-border bg-bg-secondary/20">
              <SectionHead
                icon={<Ship className="w-4 h-4 text-primary" />}
                title="Envíos"
                to="/dashboard/envios"
                cta="Logística"
              />
              {isLoading ? (
                <div className="p-4 h-16 animate-pulse" />
              ) : (ov?.shipments.recent.length ?? 0) === 0 ? (
                <Empty text="Sin embarques en curso. Crea uno desde Envíos cuando un trade llegue a etapa SPA o pago." />
              ) : (
                <ul className="divide-y divide-border">
                  {ov!.shipments.recent.map((s) => (
                    <li key={s.id}>
                      <Link
                        to="/dashboard/trades/$tradeId"
                        params={{ tradeId: s.trade_id }}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
                      >
                        <span className="font-mono text-sm shrink-0">
                          {s.reference ?? s.id.slice(0, 8)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {s.vessel_name ?? "nave por confirmar"}
                          {s.eta ? ` · ETA ${new Date(s.eta).toLocaleDateString("es-CL")}` : ""}
                        </span>
                        <span className="ml-auto flex items-center gap-2 shrink-0">
                          {s.delayed && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-600">
                              <AlertTriangle className="w-3 h-3" /> Atrasado
                            </span>
                          )}
                          <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal/10 text-teal">
                            {SHIPMENT_STATUS_LABELS[s.status]}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Firmas */}
            <section className="rounded-md border border-border bg-bg-secondary/20">
              <SectionHead
                icon={<FileSignature className="w-4 h-4 text-primary" />}
                title="Firmas electrónicas"
                to="/dashboard/documentos"
                cta="Documentos"
              />
              {isLoading ? (
                <div className="p-4 h-16 animate-pulse" />
              ) : (ov?.signs.recent.length ?? 0) === 0 ? (
                <Empty text="Sin solicitudes de firma. Envía un NDA o SPA desde Documentos — el link llega por email a la contraparte." />
              ) : (
                <ul className="divide-y divide-border">
                  {ov!.signs.recent.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-sm truncate">{s.title}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {s.signed_by_name ?? s.signer_name_expected ?? ""}
                      </span>
                      <span
                        className={`ml-auto shrink-0 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          s.status === "signed"
                            ? "bg-green-500/15 text-green-700"
                            : s.status === "pending"
                              ? "bg-amber-500/15 text-amber-700"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.status === "signed"
                          ? "Firmado"
                          : s.status === "pending"
                            ? "Pendiente"
                            : s.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Columna lateral: clientes, inventario comercial, actividad, proyecto */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Kpi
                icon={<Users className="w-4 h-4" />}
                label="Clientes"
                value={isLoading ? "…" : String(ov?.clients ?? 0)}
                hint="contrapartes de trades"
                to="/dashboard/clientes"
                compact
              />
              <Kpi
                icon={<Package className="w-4 h-4" />}
                label="Lotes + listings"
                value={isLoading ? "…" : String((ov?.lots ?? 0) + (ov?.listings ?? 0))}
                hint={`${ov?.lots ?? 0} lotes · ${ov?.listings ?? 0} proyectos`}
                to="/dashboard/commodity-lots"
                compact
              />
              {!isInvestor && (
                <Kpi
                  icon={<PackageSearch className="w-4 h-4" />}
                  label="Requerimientos"
                  value={isLoading ? "…" : String(ov?.sourcing.openRequests ?? 0)}
                  hint={`${ov?.sourcing.totalProposals ?? 0} propuestas recibidas`}
                  to="/dashboard/sourcing"
                  compact
                />
              )}
            </div>

            {/* Actividad reciente (trazabilidad) */}
            <section className="rounded-md border border-border bg-bg-secondary/20">
              <SectionHead
                icon={<TrendingUp className="w-4 h-4 text-primary" />}
                title="Actividad reciente"
              />
              {isLoading ? (
                <div className="p-4 h-24 animate-pulse" />
              ) : (ov?.events.length ?? 0) === 0 ? (
                <Empty text="La trazabilidad de tus operaciones aparecerá aquí." />
              ) : (
                <ul className="divide-y divide-border">
                  {ov!.events.slice(0, 8).map((e) => {
                    const it = normalizeEvent(e);
                    return (
                      <li key={it.id} className="px-4 py-2">
                        <div className="text-xs">{it.title}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {it.detail ? `${it.detail} · ` : ""}
                          {new Date(it.at).toLocaleString("es-CL")}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Proyecto activo → visión técnica */}
            {!isInvestor &&
              (projects.length === 0 ? (
                <Link
                  to="/dashboard/projects"
                  className="block rounded-md border border-dashed border-gold/40 bg-gold/5 hover:bg-gold/10 transition-colors p-5 text-center"
                >
                  <Plus className="w-6 h-6 text-gold mx-auto mb-2" />
                  <div className="font-mono text-sm font-semibold">Crear primer proyecto</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Para operar catastro, exploración y reportes
                  </div>
                </Link>
              ) : (
                <section className="rounded-md border border-border bg-bg-secondary/20 p-4">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    Proyecto activo
                  </div>
                  <div className="font-semibold text-sm">{active?.name ?? "—"}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <Link
                      to="/terminal"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border hover:bg-accent"
                    >
                      <Compass className="w-3.5 h-3.5" /> Terminal 2D/3D
                    </Link>
                    <Link
                      to="/catastro/mapa"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border hover:bg-accent"
                    >
                      <FileText className="w-3.5 h-3.5" /> Catastro
                    </Link>
                    <Link
                      to="/dashboard/projects"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border hover:bg-accent"
                    >
                      <FolderKanban className="w-3.5 h-3.5" /> Proyectos
                    </Link>
                    <Link
                      to="/dashboard/listings"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border hover:bg-accent"
                    >
                      <ArrowRight className="w-3.5 h-3.5" /> Venderlo
                    </Link>
                  </div>
                </section>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  to,
  warn,
  compact,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  to: string;
  warn?: boolean;
  compact?: boolean;
}) {
  // Adopta el design system (KpiTile) manteniendo el comportamiento clickable.
  return (
    <Link to={to} className="block">
      <KpiTile
        label={label}
        value={value}
        sub={hint}
        icon={icon}
        className={cn(
          "h-full transition-colors hover:border-primary/50",
          warn && "border-red-500/40",
          compact && "px-3 py-2",
        )}
      />
    </Link>
  );
}

function SectionHead({
  icon,
  title,
  to,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  to?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider">
        {icon} {title}
      </div>
      {to && cta && (
        <Link
          to={to}
          className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
        >
          {cta} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-6 text-xs text-muted-foreground">{text}</div>;
}
