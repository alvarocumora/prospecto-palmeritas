import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicCatastroShell } from "@/features/catastro-public/PublicCatastroShell";
import { WatchlistButton } from "@/features/catastro-public/WatchlistButton";
import { getConcessionByCode, getConcessionLegalStatus } from "@/lib/catastroPublic.functions";
import { getConcessionPatentePago } from "@/lib/sngmPatentePago.functions";
import {
  Building2,
  MapPin,
  Ruler,
  Calendar,
  Database,
  ArrowLeft,
  Scale,
  FileText,
  ExternalLink,
  Gavel,
  ScanSearch,
  GitCompareArrows,
  ShieldCheck,
  Receipt,
  CircleAlert,
} from "lucide-react";

export const Route = createFileRoute("/catastro/c/$code")({
  loader: async ({ params }) => {
    const data = await getConcessionByCode({ data: { code: params.code } });
    if (!data) throw notFound();
    return { concession: data };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.concession;
    const title = c
      ? `${c.name ?? c.code} · ${c.holder ?? "Sin titular"} · Catastro Chile`
      : "Ficha de concesión · Catastro Chile";
    const desc = c
      ? `Concesión minera ${c.code} (${c.concession_type}) en ${c.commune ?? c.region ?? "Chile"}. Titular ${c.holder ?? "—"}, ${c.area_ha ?? "—"} ha. Datos SERNAGEOMIN.`
      : "Ficha pública de concesión minera en Chile, datos SERNAGEOMIN.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
      ],
    };
  },
  component: ConcessionPage,
  notFoundComponent: () => (
    <PublicCatastroShell>
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">Concesión no encontrada</h1>
        <p className="text-sm text-muted-foreground mb-6">
          No hay registros para este código en cache ni en SERNAGEOMIN.
        </p>
        <Link to="/catastro/mapa" className="text-primary underline text-sm">
          Volver al mapa
        </Link>
      </div>
    </PublicCatastroShell>
  ),
  errorComponent: ({ error }) => (
    <PublicCatastroShell>
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold mb-2">Error al cargar la ficha</h1>
        <p className="text-xs font-mono text-muted-foreground">{(error as Error).message}</p>
      </div>
    </PublicCatastroShell>
  ),
});

function ConcessionPage() {
  const { concession: c } = Route.useLoaderData();
  return (
    <PublicCatastroShell>
      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <Link
          to="/catastro/mapa"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al mapa
        </Link>
        <div className="border border-border rounded-md bg-bg-secondary/20 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Concesión {c.concession_type}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{c.name ?? c.code}</h1>
              <div className="text-xs font-mono text-muted-foreground mt-1">{c.code}</div>
            </div>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-1 rounded ${
                c.status?.toLowerCase().includes("vigente")
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {c.status ?? "—"}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <Field icon={Building2} label="Titular" value={c.holder} sub={c.rut ?? undefined} />
            <Field
              icon={Ruler}
              label="Superficie"
              value={c.area_ha ? `${c.area_ha.toLocaleString("es-CL")} ha` : null}
            />
            <Field
              icon={MapPin}
              label="Ubicación"
              value={c.commune}
              sub={[c.province, c.region].filter(Boolean).join(" · ") || undefined}
            />
            <Field
              icon={Calendar}
              label="Vencimiento"
              value={c.expires_at ? new Date(c.expires_at).toLocaleDateString("es-CL") : null}
            />
          </div>

          <div className="mt-6 pt-4 border-t border-border flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <Database className="w-3 h-3" />
            Fuente:{" "}
            {c.source === "cadastre_national"
              ? "Catastro canónico Geocapitals"
              : "SERNAGEOMIN en vivo"}
            {c.last_synced_at &&
              ` · sincronizado ${new Date(c.last_synced_at).toLocaleString("es-CL")}`}
          </div>
        </div>

        <section className="mt-6 border border-border rounded-md bg-bg-secondary/20 p-6">
          <div className="flex items-center gap-2 mb-2">
            <ScanSearch className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-mono uppercase tracking-wider">Mining Intelligence</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Analiza esta concesión contra geometrías documentales, concesiones vecinas e
            intersecciones espaciales. El resultado conserva procedencia y métricas de
            reconciliación y no sustituye un estudio jurídico de títulos.
          </p>
          <div className="mt-4 grid sm:grid-cols-3 gap-2">
            <div className="rounded border border-border p-3">
              <ShieldCheck className="w-4 h-4 mb-2" />
              <div className="text-[10px] font-mono text-muted-foreground">FUENTE</div>
              <div className="text-xs font-semibold">SERNAGEOMIN</div>
            </div>
            <div className="rounded border border-border p-3">
              <GitCompareArrows className="w-4 h-4 mb-2" />
              <div className="text-[10px] font-mono text-muted-foreground">RECONCILIACIÓN</div>
              <div className="text-xs font-semibold">Espacial + identidad</div>
            </div>
            <div className="rounded border border-border p-3">
              <FileText className="w-4 h-4 mb-2" />
              <div className="text-[10px] font-mono text-muted-foreground">DUE DILIGENCE</div>
              <div className="text-xs font-semibold">Hallazgos auditables</div>
            </div>
          </div>
          <Link
            to={"/dashboard/catastro" as never}
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-xs font-mono text-primary-foreground"
          >
            <ScanSearch className="w-3.5 h-3.5" /> Analizar en Mining Intelligence
          </Link>
        </section>

        <LegalPanel code={c.code} />

        <PatentePagoPanel rol={c.code} />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <WatchlistButton code={c.code} />
          <Link
            to="/catastro/precios"
            className="text-xs font-mono text-muted-foreground hover:text-foreground underline"
          >
            Ver planes Pro
          </Link>
        </div>
      </article>
    </PublicCatastroShell>
  );
}

const PATENT_STYLES: Record<string, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-500",
  critical: "border-red-500/40 bg-red-500/10 text-red-500",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-500",
  unknown: "border-border text-muted-foreground",
};

/** Estado legal: situación SERNAGEOMIN interpretada como patente/TGR + boletín. */
function LegalPanel({ code }: { code: string }) {
  const fn = useServerFn(getConcessionLegalStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["concession-legal", code],
    queryFn: () => fn({ data: { code } }),
    staleTime: 5 * 60_000,
  });

  return (
    <section className="mt-6 border border-border rounded-md bg-bg-secondary/20 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Scale className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-wider">Estado legal y patentes</h2>
      </div>

      {isLoading ? (
        <div className="h-16 rounded bg-muted/20 animate-pulse" />
      ) : (
        <>
          {/* Señal de patente (morosidad confirmada por remate sobrescribe la inferida) */}
          {data?.patent && (
            <div className={`rounded border p-4 ${PATENT_STYLES[data.patent.level]}`}>
              <div className="flex items-center gap-2">
                {data.remate && <Gavel className="w-4 h-4 shrink-0" />}
                <div className="text-sm font-semibold">{data.patent.label}</div>
              </div>
              <p className="text-xs text-foreground/70 mt-1 leading-relaxed">
                {data.patent.detail}
              </p>
              {data.remate && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono">
                  <span>
                    Año nómina: <span className="font-semibold">{data.remate.year}</span>
                  </span>
                  {data.remate.years_owed != null && (
                    <span>
                      Años adeudados:{" "}
                      <span className="font-semibold">{data.remate.years_owed}</span>
                    </span>
                  )}
                  {data.remate.amount_clp != null && (
                    <span>
                      Deuda:{" "}
                      <span className="font-semibold">
                        ${data.remate.amount_clp.toLocaleString("es-CL")}
                      </span>
                    </span>
                  )}
                  {data.remate.court && (
                    <span>
                      Tribunal: <span className="font-semibold">{data.remate.court}</span>
                    </span>
                  )}
                  {data.remate.court_role && (
                    <span>
                      Rol causa: <span className="font-semibold">{data.remate.court_role}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Publicaciones del Boletín Oficial de Minería */}
          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-2">
              <FileText className="w-3 h-3" /> Boletín Oficial de Minería
              {data?.bulletins?.length ? ` · ${data.bulletins.length}` : ""}
            </div>
            {data?.bulletins?.length ? (
              <ul className="space-y-1.5">
                {data.bulletins.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2 text-xs font-mono"
                  >
                    <span className="min-w-0">
                      <span className="text-foreground">{b.publication_type}</span>
                      {b.publication_number && (
                        <span className="text-muted-foreground"> · N° {b.publication_number}</span>
                      )}
                      <span className="block text-[10px] text-muted-foreground">
                        {b.publication_date
                          ? new Date(b.publication_date).toLocaleDateString("es-CL")
                          : "—"}
                        {b.source && ` · ${b.source}`}
                      </span>
                    </span>
                    {b.source_url && (
                      <a
                        href={b.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                      >
                        Ver <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin publicaciones registradas para esta concesión. El monitoreo del Boletín y el rol
                de patentes de la TGR se activan con el plan Pro.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Historial real de pago de patente — consulta pública en vivo a SERNAGEOMIN. */
function PatentePagoPanel({ rol }: { rol: string }) {
  const fn = useServerFn(getConcessionPatentePago);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["concession-patente-pago", rol],
    queryFn: () => fn({ data: { rol } }),
    staleTime: 15 * 60_000,
    retry: 1,
  });

  return (
    <section className="mt-6 border border-border rounded-md bg-bg-secondary/20 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Receipt className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-mono uppercase tracking-wider">Pago de patente</h2>
        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500">
          Consulta en vivo · SERNAGEOMIN
        </span>
      </div>

      {isLoading ? (
        <div className="h-16 rounded bg-muted/20 animate-pulse" />
      ) : isError || !data ? (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          No se pudo consultar el estado de pago en este momento. Reintenta más tarde o revisa
          directamente en{" "}
          <a
            href="https://portalsdnmext.sernageomin.cl/propiedadminera/consulta-pago-concesion"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-0.5"
          >
            SERNAGEOMIN <ExternalLink className="w-3 h-3" />
          </a>
          .
        </div>
      ) : !data.found ? (
        <p className="text-xs text-muted-foreground">
          Sin registro de pagos para este rol en el sistema público de SERNAGEOMIN (puede ser una
          concesión muy reciente o el rol no coincide exactamente).
        </p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-2 mb-4 text-xs">
            <div className="text-muted-foreground">
              Titular: <span className="text-foreground">{data.titular ?? "—"}</span>
            </div>
            <div className="text-muted-foreground">
              RUT titular:{" "}
              <span className="text-foreground font-mono">{data.rutTitular ?? "—"}</span>
            </div>
          </div>
          {data.pagos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              La concesión existe en el padrón, pero no registra pagos de patente todavía.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-1.5 pr-3 font-mono font-normal">Período</th>
                    <th className="py-1.5 pr-3 font-mono font-normal">Fecha pago</th>
                    <th className="py-1.5 pr-3 font-mono font-normal">Folio</th>
                    <th className="py-1.5 pr-3 font-mono font-normal text-right">Valor pagado</th>
                    <th className="py-1.5 font-mono font-normal text-right">Hectáreas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pagos.map((p, i) => (
                    <tr key={`${p.periodo}-${i}`} className="border-b border-border/60">
                      <td className="py-1.5 pr-3 font-mono">{p.periodo}</td>
                      <td className="py-1.5 pr-3 font-mono text-muted-foreground">
                        {p.fechaPago ?? "—"}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-muted-foreground">
                        {p.folio ?? "—"}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-right">
                        {p.valorPagadoClp != null
                          ? `$${p.valorPagadoClp.toLocaleString("es-CL")}`
                          : "—"}
                      </td>
                      <td className="py-1.5 font-mono text-right text-muted-foreground">
                        {p.hectareas ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[10px] font-mono text-muted-foreground">
            Fuente: consulta pública en vivo, portalsdnmext.sernageomin.cl. Refleja los pagos
            registrados por SERNAGEOMIN al momento de la consulta; no reemplaza el certificado
            oficial de vigencia ni el rol de la Tesorería General de la República.
          </p>
        </>
      )}
    </section>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Building2;
  label: string;
  value: string | null;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded border border-border bg-background">
      <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-semibold text-foreground truncate">{value ?? "—"}</div>
        {sub && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
