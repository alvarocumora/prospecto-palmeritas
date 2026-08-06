// Ficha pública de la operación por token (comprador o vendedor).
// Muestra commodity, especificaciones y PRECIO DE VENTA. Nunca precio base,
// margen ni reparto de comisiones — esos viven en el panel interno de staff.

import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Mail, Link2, ArrowUpRight } from "lucide-react";
import { getPublicFicha, emailFichaToGeocapitals, type PublicFicha } from "@/lib/tradeFicha.functions";

export const Route = createFileRoute("/ficha/$token")({
  loader: async ({ params }) => {
    const ficha = await getPublicFicha({ data: { token: params.token } });
    if (!ficha) throw notFound();
    return ficha;
  },
  head: ({ loaderData }) => {
    const f = loaderData as PublicFicha | undefined;
    const title = f
      ? `${f.commodity ?? "Operación"}${f.reference ? ` · ${f.reference}` : ""} — Ficha de operación | Geocapitals`
      : "Ficha de operación — Geocapitals";
    const desc = f
      ? `Ficha comercial de ${f.commodity ?? "la operación"}: especificaciones, cantidad por pedido y precio de venta. Operación intermediada por Geocapitals.`
      : "Ficha comercial de operación intermediada por Geocapitals.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: f?.fichaUrl ?? "" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <main className="min-h-screen grid place-items-center bg-[#F7F5EF] p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-serif">Enlace no válido</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Esta ficha no existe o el enlace fue revocado. Escríbenos a info@geocapitals.com.
        </p>
      </div>
    </main>
  ),
  errorComponent: () => (
    <main className="min-h-screen grid place-items-center bg-[#F7F5EF] p-8">
      <p className="text-sm text-neutral-600">No pudimos cargar la ficha. Intenta nuevamente.</p>
    </main>
  ),
  component: FichaPublica,
});

function money(n: number | null | undefined, currency: string | null | undefined, unit?: string | null) {
  if (n == null) return "—";
  const cur = currency === "USD" ? "US$" : "$";
  return `${cur} ${Math.round(n).toLocaleString("es-CL")}${unit ? ` / ${unit}` : ""}`;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-200 py-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-900 text-right">{value}</span>
    </div>
  );
}

function FichaPublica() {
  const f = Route.useLoaderData();
  const { token } = Route.useParams();
  const [sending, setSending] = useState(false);

  const p = f.pricing;
  const prod = f.products[0];
  const priceLabel = money(p?.sale_price ?? null, p?.currency ?? null, p?.unit ?? null);
  const wsp = `https://wa.me/56962184071?text=${encodeURIComponent(
    `Hola Geocapitals, consulto por la operación ${f.reference ?? f.commodity ?? ""} — ${f.fichaUrl}`,
  )}`;

  const sendEmail = async () => {
    setSending(true);
    try {
      const r = await emailFichaToGeocapitals({ data: { token } });
      if (r.ok) toast.success("Ficha enviada a la mesa de Geocapitals.");
      else toast.error(r.error ?? "No se pudo enviar la ficha.");
    } catch {
      toast.error("No se pudo enviar la ficha.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F5EF] px-4 py-10">
      <div className="mx-auto max-w-2xl bg-white border border-neutral-200 shadow-sm">
        <header className="border-b border-neutral-200 px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
            Geocapitals · Ficha de operación
          </p>
          <h1 className="mt-1 font-serif text-3xl text-neutral-900">{f.commodity ?? "Operación"}</h1>
          {f.reference ? (
            <p className="mt-1 text-xs text-neutral-500">Referencia {f.reference}</p>
          ) : null}
        </header>

        <section className="px-6 py-5">
          <div className="mb-4 rounded border border-[#1B3FAE]/25 bg-[#1B3FAE]/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-[#1B3FAE]">Precio de venta</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{priceLabel}</p>
            {p?.qty_per_order != null ? (
              <p className="mt-1 text-xs text-neutral-600">
                Cantidad por pedido: {Number(p.qty_per_order).toLocaleString("es-CL")} {p.unit ?? ""}
                {p.order_frequency ? ` · ${p.order_frequency}` : ""}
                {p.contract_months ? ` · contrato ${p.contract_months} meses` : ""}
              </p>
            ) : null}
          </div>

          <Row label="Producto" value={prod?.product_name} />
          <Row label="Presentación" value={prod?.presentation} />
          <Row label="Pureza / ley" value={prod?.purity} />
          <Row label="Envase" value={prod?.packaging} />
          <Row
            label="Procedencia"
            value={[prod?.origin_region, prod?.origin_country].filter(Boolean).join(", ") || null}
          />
          <Row label="Incoterm" value={prod?.incoterm} />
          <Row label="Código HS" value={prod?.hs_code} />
          <Row
            label="Tonelaje mensual"
            value={prod?.tonnage_monthly_t != null ? `${prod.tonnage_monthly_t} t` : null}
          />

          {f.products.length > 1 ? (
            <div className="mt-5">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Otros productos</p>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                {f.products.slice(1).map((x, i) => (
                  <li key={i}>
                    · {x.product_name}
                    {x.purity ? ` — ${x.purity}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <footer className="flex flex-wrap gap-2 border-t border-neutral-200 px-6 py-4 text-xs">
          <a
            href={wsp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Compartir por WhatsApp
          </a>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(f.fichaUrl);
              toast.success("Enlace copiado");
            }}
            className="inline-flex items-center gap-1 rounded border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
          >
            <Link2 className="h-3.5 w-3.5" /> Copiar enlace
          </button>
          <button
            type="button"
            onClick={() => void sendEmail()}
            disabled={sending}
            className="inline-flex items-center gap-1 rounded border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-50"
          >
            <Mail className="h-3.5 w-3.5" /> {sending ? "Enviando…" : "Enviar por correo"}
          </button>
          <a
            href={f.operacionUrl}
            className="ml-auto inline-flex items-center gap-1 rounded bg-[#1B3FAE] px-3 py-1.5 text-white hover:opacity-90"
          >
            Ir a la sala de operación <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </footer>
      </div>
      <p className="mx-auto mt-4 max-w-2xl text-center text-[11px] text-neutral-500">
        Documento comercial preliminar · no constituye oferta vinculante · info@geocapitals.com
      </p>
    </main>
  );
}
