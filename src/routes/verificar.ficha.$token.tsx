import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Eye,
  Send,
  ArrowRight,
  PackageSearch,
  Layers,
  Clock,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { verifySupplierShareToken } from "@/lib/sourcing.functions";
import { PUBLIC_APP_HOST } from "@/lib/publicUrl";

export const Route = createFileRoute("/verificar/ficha/$token")({
  head: () => ({
    meta: [
      { title: "Verificación de ficha · Geocapitals" },
      {
        name: "description",
        content:
          "Verifica la autenticidad de una ficha de proveedor compartida por Geocapitals: vigencia del enlace, número de vistas y trade real vinculado.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyShareTokenPage,
});

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function VerifyShareTokenPage() {
  const { token } = Route.useParams();
  const verifyFn = useServerFn(verifySupplierShareToken);
  const { data, isLoading, error } = useQuery({
    queryKey: ["verify-share", token],
    queryFn: () => verifyFn({ data: { token } }),
    retry: false,
    // Registra una visita por carga; nunca reintenta ni se refresca.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const meta = data ? STATUS_META[data.status] : null;
  const Icon = meta?.icon ?? Clock;

  return (
    <main data-theme="im-light" className="min-h-screen bg-surface">
      <header className="border-b border-hairline bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-content">
            <Logo size={22} />
          </Link>
          <span className="text-[12px] font-mono text-content-subtle">{PUBLIC_APP_HOST}</span>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-accent-brand">
            Verificación de ficha
          </div>
          <h1 className="font-display text-3xl lg:text-4xl mt-2 text-content">
            Autenticidad del enlace compartido
          </h1>
          <p className="text-sm text-content-subtle mt-2 max-w-2xl">
            Geocapitals verifica el token de la ficha contra su registro criptográfico. Cada
            apertura queda contabilizada para trazabilidad del emisor.
          </p>
        </div>

        <div className="rounded-2xl border border-hairline bg-white overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-hairline flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-content-subtle">
                Prefijo del token
              </div>
              <div className="font-mono text-lg text-content mt-1 truncate">
                {data?.tokenPrefix ?? "…"}
              </div>
            </div>
            <ShieldCheck className="w-6 h-6 text-accent-brand shrink-0" />
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-sm text-content-subtle">
              Verificando integridad del token en Geocapitals…
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-red-700 bg-red-50">
              No pudimos completar la verificación: {(error as Error).message}
            </div>
          ) : data ? (
            <>
              <div className="px-6 py-5">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium ${meta?.tone}`}
                >
                  <Icon className="w-4 h-4" />
                  {meta?.label}
                </span>
                <p className="text-sm text-content mt-3">{meta?.description}</p>
              </div>

              {data.status === "valid" || data.status === "revoked" ? (
                <>
                  {/* Contadores */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border-y border-hairline">
                    <Metric icon={Eye} label="Vistas válidas" value={String(data.viewCount)} />
                    <Metric icon={Send} label="Envíos NCNDA" value={String(data.dispatchCount)} />
                    <Metric icon={Clock} label="Emitida" value={fmt(data.firstIssuedAt)} small />
                    <Metric
                      icon={Clock}
                      label="Última apertura"
                      value={fmt(data.lastViewedAt)}
                      small
                    />
                  </div>

                  {/* Proveedor + requerimiento */}
                  <dl className="divide-y divide-hairline">
                    {data.supplier ? (
                      <Row
                        label="Proveedor"
                        value={
                          [
                            data.supplier.name,
                            data.supplier.company,
                            data.supplier.country,
                            data.supplier.role,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"
                        }
                      />
                    ) : null}
                    {data.request ? (
                      <>
                        <Row label="Referencia" value={data.request.reference} mono />
                        <Row
                          label="Commodity"
                          value={`${data.request.commodity}${data.request.quantityT ? ` · ${data.request.quantityT} t` : ""}`}
                        />
                        {data.request.incoterm || data.request.destination ? (
                          <Row
                            label="Logística"
                            value={
                              [data.request.incoterm, data.request.destination]
                                .filter(Boolean)
                                .join(" · ") || "—"
                            }
                          />
                        ) : null}
                      </>
                    ) : null}

                    {/* Trade real conectado */}
                    <div className="grid grid-cols-[160px_1fr] gap-4 px-6 py-3">
                      <dt className="text-[11px] font-mono uppercase tracking-wide text-content-subtle self-center">
                        Trade conectado
                      </dt>
                      <dd className="text-sm text-content">
                        {data.trade ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Layers className="w-4 h-4 text-accent-brand" />
                            <span className="font-mono">{data.trade.reference ?? "—"}</span>
                            {data.trade.commodity ? (
                              <span className="text-content-subtle">· {data.trade.commodity}</span>
                            ) : null}
                            {data.trade.quantityT != null ? (
                              <span className="text-content-subtle">
                                · {data.trade.quantityT} t
                              </span>
                            ) : null}
                            <span
                              className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                data.trade.status === "active"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : data.trade.status === "cancelled"
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                              }`}
                            >
                              {data.trade.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-content-subtle">
                            Sin trade vinculado (ficha en pre-negociación).
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  {data.status === "valid" && data.sheetPath ? (
                    <div className="px-6 py-5 border-t border-hairline bg-surface-subtle flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[12px] text-content-subtle">
                        La ficha es auténtica y está vigente. Puedes abrirla ahora.
                      </div>
                      <a
                        href={data.sheetPath}
                        className="inline-flex items-center gap-2 rounded-lg bg-accent-brand text-white px-4 py-2 text-sm font-medium hover:opacity-90"
                      >
                        <PackageSearch className="w-4 h-4" /> Abrir ficha
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}

          <div className="border-t border-hairline bg-surface-subtle px-6 py-4 text-[11px] font-mono text-content-subtle">
            El emisor de la ficha ve las visitas registradas para trazabilidad. No exponemos IP ni
            datos personales. Dudas:{" "}
            <a href="mailto:info@geocapitals.com" className="text-accent-brand underline">
              info@geocapitals.com
            </a>
            .
          </div>
        </div>
      </section>
    </main>
  );
}

const STATUS_META = {
  valid: {
    label: "Enlace auténtico y vigente",
    icon: ShieldCheck,
    tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
    description:
      "El token coincide con el registro criptográfico de Geocapitals. La ficha es original y no ha sido revocada.",
  },
  revoked: {
    label: "Enlace revocado por el emisor",
    icon: ShieldAlert,
    tone: "text-amber-700 bg-amber-50 border-amber-200",
    description:
      "El emisor invalidó este enlace. La información antes compartida ya no debe considerarse vigente.",
  },
  not_found: {
    label: "Enlace no reconocido",
    icon: ShieldX,
    tone: "text-red-700 bg-red-50 border-red-200",
    description:
      "Este token no existe en Geocapitals. Podría estar alterado, ser falso, o pertenecer a una ficha eliminada.",
  },
  invalid_format: {
    label: "Formato de token inválido",
    icon: ShieldX,
    tone: "text-red-700 bg-red-50 border-red-200",
    description:
      "El token no cumple con el formato de un enlace legítimo de Geocapitals. Confirma con el emisor.",
  },
} as const;

function Metric({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <div className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-content-subtle">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`mt-1 text-content ${small ? "text-[13px]" : "text-2xl font-display"}`}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 px-6 py-3">
      <dt className="text-[11px] font-mono uppercase tracking-wide text-content-subtle self-center">
        {label}
      </dt>
      <dd className={`text-sm text-content ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
