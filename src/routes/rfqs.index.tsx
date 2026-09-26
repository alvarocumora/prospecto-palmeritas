import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPublicRfqs } from "@/lib/rfqs/rfq.functions";

export const Route = createFileRoute("/rfqs/")({
  head: () => ({
    meta: [
      { title: "Marketplace de RFQ mineros — Geocapitals" },
      {
        name: "description",
        content:
          "Solicitudes de cotización activas de compradores globales de mineral: cobre, oro, antimonio, tierras raras. Postúlate como proveedor verificado.",
      },
      { property: "og:title", content: "Marketplace de RFQ mineros — Geocapitals" },
      {
        property: "og:description",
        content: "Compradores buscando concentrados y minerales verificados en LatAm.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Marketplace,
});

type Row = Awaited<ReturnType<typeof listPublicRfqs>>[number];

function Marketplace() {
  const list = useServerFn(listPublicRfqs);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setRows(await list());
      setLoading(false);
    })();
  }, [list]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      (r.buyer_company ?? "").toLowerCase().includes(s) ||
      (r.destination_country ?? "").toLowerCase().includes(s) ||
      r.products.some((p) => p.product_name.toLowerCase().includes(s))
    );
  });

  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
    >
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
          Marketplace público · RFQ mineros
        </div>
        <h1 className="mt-1 font-serif text-4xl">Compradores buscando mineral hoy</h1>
        <p className="mt-2 max-w-2xl text-sm text-[hsl(var(--content-subtle))]">
          Solicitudes activas de cotización publicadas por compradores en Geocapitals. Regístrate
          como proveedor, postula tu oferta y recibe respuestas dentro de la plataforma bajo NDA.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            className="w-full max-w-sm rounded border border-[hsl(var(--hairline))] bg-white px-3 py-2 text-sm"
            placeholder="Buscar por producto, país o comprador"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Link
            to="/inscripcion"
            className="rounded bg-[hsl(var(--accent-brand))] px-3 py-2 text-sm text-white"
          >
            Inscribirme como proveedor
          </Link>
          <div className="ml-auto text-xs text-[hsl(var(--content-subtle))]">
            {loading ? "Cargando…" : `${filtered.length} RFQ activos`}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((r) => (
            <article
              key={r.id}
              className="rounded border border-[hsl(var(--hairline))] bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[hsl(var(--content-subtle))]">
                    {r.public_ref}
                  </div>
                  <h3 className="font-serif text-xl">
                    {r.buyer_company ?? "Comprador confidencial"}
                  </h3>
                  <div className="mt-1 text-xs text-[hsl(var(--content-subtle))]">
                    {r.destination_country ?? "Destino confidencial"} ·{" "}
                    {r.incoterm ?? "Incoterm por acordar"}
                  </div>
                </div>
                <span className="rounded-full bg-[hsl(var(--surface))] px-2 py-0.5 text-[10px] uppercase tracking-wide">
                  {r.status === "publicado" ? "Abierto" : "En evaluación"}
                </span>
              </div>
              <ul className="mt-4 space-y-2 border-t border-[hsl(var(--hairline))] pt-3 text-sm">
                {r.products.map((p, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{p.product_name}</span>
                    <span className="text-xs text-[hsl(var(--content-subtle))]">
                      {p.qty_monthly_mt ? `${p.qty_monthly_mt} t/mes` : ""}
                      {p.qty_total_mt
                        ? `${p.qty_monthly_mt ? " · " : ""}${p.qty_total_mt} t total`
                        : ""}
                      {p.port_destination ? ` · ${p.port_destination}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-end">
                <Link to="/inscripcion" className="text-sm text-[hsl(var(--accent-brand))]">
                  Postular a este RFQ →
                </Link>
              </div>
            </article>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="col-span-full rounded border border-dashed border-[hsl(var(--hairline))] p-10 text-center text-sm text-[hsl(var(--content-subtle))]">
              No hay RFQ activos con esos criterios.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
