import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listInboxSuppliers, type InboxSupplier } from "@/lib/suppliers/inbox.functions";
import { Input } from "@/components/ui/input";
import { ArrowRight, Filter } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/proveedores/")({
  head: () => ({
    meta: [
      { title: "Bandeja de proveedores — Geocapitals" },
      {
        name: "description",
        content:
          "Bandeja interna del equipo Geocapitals para revisar, calificar y avanzar inscripciones de proveedores de mineral.",
      },
    ],
  }),
  component: InboxPage,
});

const STATUSES: Array<{ v: string; label: string }> = [
  { v: "", label: "Todos" },
  { v: "nuevo", label: "Nuevos" },
  { v: "en_revision", label: "En revisión" },
  { v: "verificado", label: "Verificados" },
  { v: "documentos_incompletos", label: "Documentos incompletos" },
  { v: "descartado", label: "Descartados" },
];

const STATUS_COLOR: Record<string, string> = {
  nuevo: "bg-sky-100 text-sky-800",
  en_revision: "bg-amber-100 text-amber-800",
  verificado: "bg-emerald-100 text-emerald-800",
  documentos_incompletos: "bg-orange-100 text-orange-800",
  descartado: "bg-gray-200 text-gray-700",
};

function InboxPage() {
  const load = useServerFn(listInboxSuppliers);
  const [rows, setRows] = useState<InboxSupplier[]>([]);
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const data = await load({
        data: { status: status || undefined, country: country || undefined, search: search || undefined },
      });
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [load, status, country, search]);

  const totalsByStatus = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of rows) acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, [rows]);

  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
    >
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
              Staff · Portal de proveedores
            </div>
            <h1 className="mt-1 font-serif text-3xl">Bandeja de inscripciones</h1>
            <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--content-subtle))]">
              Cada fila es un proveedor que completó el formulario público. Entra al detalle para
              revisar oferta, documentos y ejecutar la extracción IA del certificado.
            </p>
          </div>
          <Link
            to="/dashboard/enlaces"
            className="text-xs underline text-[hsl(var(--content-subtle))]"
          >
            Gestionar enlaces
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 rounded border border-[hsl(var(--hairline))] bg-white p-3">
          <Filter className="h-4 w-4 text-[hsl(var(--content-subtle))]" />
          <select
            className="rounded border border-[hsl(var(--hairline))] bg-white px-2 py-1 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-[hsl(var(--hairline))] bg-white px-2 py-1 text-sm"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="">Todos los países</option>
            <option value="CL">Chile</option>
            <option value="PE">Perú</option>
            <option value="AR">Argentina</option>
            <option value="BO">Bolivia</option>
            <option value="OTRO">Otro</option>
          </select>
          <Input
            placeholder="Buscar por nombre, folio o correo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <div className="ml-auto text-xs text-[hsl(var(--content-subtle))]">
            {loading ? "Cargando…" : `${rows.length} resultado(s)`}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {Object.entries(totalsByStatus).map(([k, n]) => (
            <span
              key={k}
              className={`rounded-full px-2 py-0.5 uppercase tracking-wide ${STATUS_COLOR[k] ?? "bg-gray-100 text-gray-600"}`}
            >
              {k.replace(/_/g, " ")}: {n}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto rounded border border-[hsl(var(--hairline))] bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-[hsl(var(--surface))] text-xs uppercase tracking-wide text-[hsl(var(--content-subtle))]">
              <tr>
                <th className="p-3 text-left">Folio</th>
                <th className="p-3 text-left">Empresa</th>
                <th className="p-3 text-left">País</th>
                <th className="p-3 text-left">Producto</th>
                <th className="p-3 text-right">Ofertas</th>
                <th className="p-3 text-right">Docs</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[hsl(var(--content-subtle))]">
                    Sin inscripciones con estos filtros.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-[hsl(var(--hairline))] hover:bg-[hsl(var(--surface))]/40">
                    <td className="p-3 font-mono text-xs">{r.folio}</td>
                    <td className="p-3">
                      <div className="font-medium">{r.legal_name}</div>
                      <div className="text-xs text-[hsl(var(--content-subtle))]">
                        {r.contact_name} · {r.email}
                      </div>
                    </td>
                    <td className="p-3">{r.country}</td>
                    <td className="p-3">{r.primary_product ?? "—"}</td>
                    <td className="p-3 text-right font-mono">{r.offers_count}</td>
                    <td className="p-3 text-right font-mono">{r.docs_count}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs uppercase tracking-wide ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to="/dashboard/proveedores/$id"
                        params={{ id: r.id }}
                        className="inline-flex items-center gap-1 text-sm text-[hsl(var(--accent-brand))]"
                      >
                        Abrir <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
