import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, FileSearch, Layers, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { getMyInvestmentHistory } from "@/lib/investors.functions";
import { listMyHoldings } from "@/lib/tokenization.functions";
import { getMyWallet, getPublicRounds, type PublicRound } from "@/lib/wallet.functions";
import { RoundProgress } from "@/features/investor/RoundProgress";
import { PROJECT_TERMS } from "@/features/investor/projectTerms";
import { BrandButton } from "@/components/brand";
import { InvestmentCard } from "@/features/investor/InvestmentCard";
import { getTerminalProject } from "@/features/terminal/terminalProjects";
import { confirmedPositionSummary, money } from "@/features/investor/investmentPresentation";
import cholquiCover from "@/assets/sat-cholqui.jpg.asset.json";
import verdesCover from "@/assets/sat-losverdes.jpg.asset.json";
import { ActiveProjectCard } from "./ActiveProjectCard";

const usd = (value: number) => "USD " + value.toLocaleString("es-CL", { maximumFractionDigits: 0 });
const statusLabels: Record<string, string> = {
  new: "Interés registrado",
  nda_signed: "NDA firmado",
  closed: "Cerrada",
  pending: "Pendiente",
  approved: "Aprobado",
  pending_review: "En revisión",
  rejected: "Requiere revisión",
};

export function InvestorHome({ name, children }: { name: string; children?: ReactNode }) {
  const { user } = useAuth();
  const { active } = useProjects();
  const fetchHistory = useServerFn(getMyInvestmentHistory);
  const fetchHoldings = useServerFn(listMyHoldings);
  const fetchWallet = useServerFn(getMyWallet);
  const fetchRounds = useServerFn(getPublicRounds);
  const history = useQuery({
    queryKey: ["investor-history", user?.id],
    queryFn: () => fetchHistory(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const holdings = useQuery({
    queryKey: ["my-holdings", user?.id],
    queryFn: () => fetchHoldings(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const wallet = useQuery({
    queryKey: ["my-wallet", user?.id],
    queryFn: () => fetchWallet(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const rounds = useQuery({
    queryKey: ["public-rounds"],
    queryFn: () => fetchRounds(),
    staleTime: 60_000,
  });

  const positions = wallet.data ? confirmedPositionSummary(wallet.data.positions) : null;
  const capitalLabel = positions ? [...positions.capital].map(([c, n]) => money(n, c)).join(" · ") || "Sin posiciones" : null;
  const data = history.data;
  const inquiries = data?.inquiries ?? [];
  const confirmed = (holdings.data ?? []).filter((holding) => holding.status === "confirmed");
  const latest = inquiries.slice(0, 5);
  const formattedName = name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toLocaleUpperCase("es-CL") + part.slice(1))
    .join(" ");

  return (
    <div data-theme="im-light" className="min-h-full bg-surface text-content">
      <main className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-7">
        <header className="space-y-4 border-b border-hairline pb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-content-subtle">
            Geocapitals · Espacio del inversionista
          </p>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="font-serif text-3xl text-content md:text-4xl">
                Hola{formattedName ? `, ${formattedName}` : ""}.
              </h1>
              <p className="mt-2 max-w-xl text-sm text-content-subtle">
                Evalúa oportunidades, revisa documentos y sigue el avance de tus inversiones.
              </p>
            </div>
            <Link
              to="/proyectos"
              className="inline-flex items-center gap-2 rounded-md bg-accent-brand px-4 py-2.5 text-sm font-medium text-accent-brand-contrast"
            >
              Explorar proyectos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Hero de patrimonio: solo posiciones SPV confirmadas; "—" mientras carga */}
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-3">
            <PatrimonioCell
              label="Capital aportado · posiciones confirmadas"
              value={wallet.data ? capitalLabel ?? "—" : wallet.isError ? "No disponible" : "—"}
              note="Solo posiciones liquidadas y confirmadas por el equipo."
            />
            <PatrimonioCell
              label="Acciones confirmadas"
              value={
                wallet.data
                  ? positions?.shares.toLocaleString("es-CL") ?? "—"
                  : wallet.isError
                    ? "No disponible"
                    : "—"
              }
              note="Serie preferente emitida por la SPV de cada proyecto."
            />
            <PatrimonioCell
              label="Tickets en curso"
              value={
                wallet.data
                  ? usd(wallet.data.totals.pending)
                  : wallet.isError
                    ? "No disponible"
                    : "—"
              }
              note="Órdenes emitidas pendientes de firma, pago o liquidación."
            />
          </div>
        </header>

        {children && (
          <details className="rounded-lg border border-hairline bg-surface">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-content marker:hidden">
              <span className="mr-2 rounded-full bg-accent-brand-subtle px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-accent-brand">
                Perfil
              </span>
              Completa la configuración de tu cuenta
            </summary>
            <div className="border-t border-hairline p-3 md:p-4">{children}</div>
          </details>
        )}

        {/* Explorar: rondas abiertas con datos reales */}
        <section aria-label="Proyectos en ronda">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-content-subtle">
                Explorar
              </p>
              <h2 className="mt-1 font-serif text-xl text-content">Proyectos en ronda</h2>
            </div>
            <Link to="/proyectos" className="text-sm text-accent-brand hover:underline">
              Catálogo completo
            </Link>
          </div>
          {rounds.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-lg border border-hairline bg-surface-2" />
              ))}
            </div>
          ) : rounds.isError ? (
            <p role="status" className="rounded-lg border border-hairline p-5 text-sm text-content-subtle">
              No pudimos cargar las rondas.{" "}
              <BrandButton variant="ghost" className="text-accent-brand underline" onClick={() => void rounds.refetch()}>
                Reintentar
              </BrandButton>
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(rounds.data ?? []).map((r) => (
                <RoundCard key={r.code} round={r} />
              ))}
            </div>
          )}
        </section>

        <ActiveProjectCard project={active} />

        <div className="grid gap-4 sm:grid-cols-3">
          <InvestorMetric
            icon={<FileSearch className="h-4 w-4" />}
            title="Oportunidades en evaluación"
            value={
              data
                ? String(inquiries.filter((item) => !item.closed_at).length)
                : history.isError
                  ? "No disponible"
                  : "…"
            }
            description={
              data && inquiries.filter((item) => !item.closed_at).length === 0
                ? "Sin solicitudes activas. Explora proyectos disponibles."
                : "Solicitudes abiertas; todavía no son inversiones."
            }
          />
          <InvestorMetric
            icon={<Wallet className="h-4 w-4" />}
            title="Pagos registrados"
            value={data ? usd(data.totals.paidUsd) : history.isError ? "No disponible" : "…"}
            description={
              data?.totals.paidUsd === 0
                ? "Aún no hay pagos registrados en tu cuenta."
                : "Liquidaciones registradas como pagadas o recibidas."
            }
          />
          <InvestorMetric
            icon={<Layers className="h-4 w-4" />}
            title="Participaciones confirmadas"
            value={
              holdings.data ? String(confirmed.length) : holdings.isError ? "No disponible" : "…"
            }
            description={
              holdings.data && confirmed.length === 0
                ? "Aún no tienes participaciones confirmadas."
                : "Suscripciones confirmadas; consulta sus términos."
            }
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-lg border border-hairline bg-surface-3">
            <header className="flex justify-between gap-3 border-b border-hairline p-5">
              <h2 className="font-serif text-xl">Tu seguimiento</h2>
              <Link to="/dashboard/investments" className="text-sm text-accent-brand hover:underline">
                Ver portafolio
              </Link>
            </header>
            {history.isError ? (
              <div role="status" className="p-5 text-sm text-content-subtle">
                No pudimos cargar tu historial.{" "}
                <BrandButton variant="ghost" className="text-accent-brand underline" onClick={() => void history.refetch()}>
                  Reintentar
                </BrandButton>
              </div>
            ) : history.isLoading ? (
              <p role="status" className="p-5 text-sm text-content-subtle">
                Cargando oportunidades…
              </p>
            ) : latest.length ? (
              <ul className="divide-y divide-hairline">
                {latest.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-5"
                  >
                    <div>
                      <Link
                        to="/proyectos/$listingId"
                        params={{ listingId: item.listing_id }}
                        className="font-medium hover:underline"
                      >
                        {item.listing?.title ?? "Revisar oportunidad"}
                      </Link>
                      <p className="mt-1 text-xs text-content-subtle">
                        {item.listing?.commodity ?? "Minería"} ·{" "}
                        {item.nda_signed_at ? "NDA firmado" : "NDA pendiente"}
                      </p>
                    </div>
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px]">
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3 p-6">
                <h3 className="font-medium">Comienza por una tesis de inversión</h3>
                <p className="text-sm text-content-subtle">
                  Revisa etapa, evidencias, uso de fondos y riesgos. Tus solicitudes aparecerán aquí
                  al registrar interés.
                </p>
                <Link
                  to="/proyectos"
                  className="inline-flex items-center gap-2 text-sm text-accent-brand hover:underline"
                >
                  Explorar proyectos <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </section>
          <section className="space-y-5 rounded-lg border border-hairline bg-surface-3 p-5">
            <div>
              <p className="font-mono text-[10px] uppercase text-content-subtle">
                Perfil de inversión
              </p>
              <h2 className="mt-2 font-serif text-xl">
                {data?.profile
                  ? (statusLabels[data.profile.review_status] ?? data.profile.review_status)
                  : history.isError
                    ? "Estado no disponible"
                    : history.isLoading
                      ? "Consultando perfil…"
                      : "Completa tu perfil"}
              </h2>
              <p className="mt-2 text-sm text-content-subtle">
                Mantén tus preferencias y antecedentes al día para avanzar en la evaluación de
                oportunidades.
              </p>
            </div>
            <div className="space-y-3 border-t border-hairline pt-4">
              <Link
                to="/dashboard/offerings"
                className="flex items-center justify-between text-sm hover:text-accent-brand"
              >
                Ofertas y participaciones <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/terminal"
                className="flex items-center justify-between text-sm hover:text-accent-brand"
              >
                Terminal de proyectos <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/terminal/market"
                className="flex items-center justify-between text-sm hover:text-accent-brand"
              >
                Referencias de mercado <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {holdings.isError && (
              <p role="status" className="text-xs text-content-subtle">
                No pudimos consultar las participaciones.{" "}
                <BrandButton variant="ghost" onClick={() => void holdings.refetch()} className="text-accent-brand underline">
                  Reintentar
                </BrandButton>
              </p>
            )}
          </section>
        </div>

        <p className="text-[11px] leading-relaxed text-content-subtle">
          Inversión privada en activos mineros: riesgo de pérdida total y liquidez limitada. Las
          cifras de tenencia y producción son declaradas por el titular; no constituyen recursos
          certificados NI 43-101/JORC.
        </p>
      </main>
    </div>
  );
}

function PatrimonioCell({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="bg-surface-3 p-4 md:p-5">
      <p className="text-[11px] text-content-subtle">{label}</p>
      <p className="mt-1 font-serif text-2xl text-content md:text-3xl">{value}</p>
      <p className="mt-1 text-[11px] text-content-subtle">{note}</p>
    </div>
  );
}

function RoundCard({ round }: { round: PublicRound }) {
  const terms = PROJECT_TERMS[round.slug];
  const ficha = getTerminalProject(round.slug)?.ficha;
  return <InvestmentCard title={round.name} region={ficha?.region ?? "Ubicación por verificar"} commodity={ficha?.commodity ?? ""} stage={round.open ? "Ronda abierta · explotación declarada" : "Ronda cerrada · explotación declarada"}
    image={round.slug === "cholqui" ? cholquiCover.url : verdesCover.url} imageLabel="Imagen de archivo · procedencia por verificar" slug={round.slug}>
    <p className="text-xs text-content-muted"><span className="font-mono">{terms.hectares.direct.toLocaleString("es-CL")} ha directas · {terms.hectares.district.toLocaleString("es-CL")} ha distrito</span><br />DECLARADO · titular · tenencia sujeta a verificación</p>
    <RoundProgress round={round} compact />
    <p className="text-[10px] text-content-muted">Inversión privada, riesgo de pérdida y liquidez limitada. Sin recursos certificados NI 43-101/JORC.</p>
  </InvestmentCard>;
}

function InvestorMetric({
  icon,
  title,
  value,
  description,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <section className="rounded-lg border border-hairline bg-surface-3 p-5">
      <div className="flex items-center gap-2 text-xs text-content-subtle">
        {icon}
        {title}
      </div>
      <p className="mt-3 font-serif text-2xl">{value}</p>
      <p className="mt-2 text-xs text-content-subtle">{description}</p>
    </section>
  );
}
