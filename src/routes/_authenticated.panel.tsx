import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  claimMySupplier,
  getMySupplier,
  type MyDocument,
  type MyOffer,
  type MySupplier,
} from "@/lib/suppliers/panel.functions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, FileText, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Mi panel de proveedor — Geocapitals" },
      {
        name: "description",
        content:
          "Panel del proveedor: estado de tu inscripción, documentos pendientes y avance de tus ofertas.",
      },
    ],
  }),
  component: SupplierPanel,
});

function SupplierPanel() {
  const claim = useServerFn(claimMySupplier);
  const load = useServerFn(getMySupplier);
  const [supplier, setSupplier] = useState<MySupplier | null>(null);
  const [offers, setOffers] = useState<MyOffer[]>([]);
  const [documents, setDocuments] = useState<MyDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Vincula (idempotente) la inscripción pública al usuario logeado.
      await claim({}).catch(() => undefined);
      const res = await load({});
      setSupplier(res.supplier);
      setOffers(res.offers);
      setDocuments(res.documents);
      setLoading(false);
    })();
  }, [claim, load]);

  if (loading) {
    return (
      <div className="p-8 text-sm text-[hsl(var(--content-subtle))]">Cargando tu panel…</div>
    );
  }

  if (!supplier) {
    return (
      <div
        data-theme="im-light"
        className="min-h-screen bg-[hsl(var(--surface-paper))] px-4 py-12"
      >
        <div className="mx-auto max-w-xl text-center">
          <h1 className="font-serif text-3xl">Aún no tienes inscripción</h1>
          <p className="mt-4 text-sm text-[hsl(var(--content-subtle))]">
            No encontramos una inscripción de proveedor asociada a tu correo. Completa el
            formulario público con el mismo correo con el que iniciaste sesión.
          </p>
          <Link
            to="/inscripcion"
            className="mt-6 inline-block rounded bg-[hsl(var(--accent-brand))] px-4 py-2 text-sm text-white"
          >
            Ir al formulario de inscripción
          </Link>
        </div>
      </div>
    );
  }

  const requiredDocs = [
    { key: "certificado_analisis", label: "Certificado de análisis" },
    { key: "titulo_mandato", label: "Título o mandato de la concesión" },
    { key: "fotos_faena", label: "Fotos de la faena y del material" },
    { key: "estatutos", label: "Estatutos / constitución legal" },
  ];
  const uploadedTypes = new Set(documents.map((d) => d.doc_type));

  return (
    <div
      data-theme="im-light"
      className="min-h-screen bg-[hsl(var(--surface-paper))] text-[hsl(var(--content))]"
    >
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--content-subtle))]">
            Portal de proveedores · Folio {supplier.folio}
          </div>
          <h1 className="mt-1 font-serif text-3xl">{supplier.legal_name}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--content-subtle))]">
            {supplier.country} · {supplier.contact_name} · {supplier.email}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StateCard label="Estado global" value={supplier.status.replace(/_/g, " ")} />
          <StateCard label="Ofertas registradas" value={String(offers.length)} />
          <StateCard
            label="Documentos subidos"
            value={`${documents.length} de ${requiredDocs.length}`}
          />
        </div>

        <section className="mt-10">
          <h2 className="font-serif text-xl">Documentos requeridos</h2>
          <div className="mt-4 divide-y divide-[hsl(var(--hairline))] rounded border border-[hsl(var(--hairline))] bg-white">
            {requiredDocs.map((d) => {
              const done = uploadedTypes.has(d.key);
              return (
                <div key={d.key} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-[hsl(var(--content-subtle))]" />
                    <span className="text-sm">{d.label}</span>
                  </div>
                  {done ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Cargado
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" disabled title="Próximamente en este panel">
                      <Upload className="mr-2 h-3 w-3" /> Pendiente
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[hsl(var(--content-subtle))]">
            La subida de archivos se habilita cuando nuestro equipo confirma la revisión inicial.
            Mientras tanto puedes enviarlos a{" "}
            <a href="mailto:info@geocapitals.com" className="underline">
              info@geocapitals.com
            </a>{" "}
            citando tu folio.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-serif text-xl">Tus ofertas</h2>
          {offers.length === 0 ? (
            <p className="mt-2 text-sm text-[hsl(var(--content-subtle))]">
              Aún no registras ofertas activas.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {offers.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded border border-[hsl(var(--hairline))] bg-white p-4"
                >
                  <div>
                    <div className="font-serif text-lg">{o.product}</div>
                    <div className="mt-1 text-xs text-[hsl(var(--content-subtle))]">
                      {o.tonnage_available_t ? `${o.tonnage_available_t} t · ` : ""}
                      {o.grade_value != null ? `${o.grade_value} ${o.grade_unit ?? ""} · ` : ""}
                      {o.port_or_delivery ?? "sin puerto"}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--surface))] px-3 py-1 text-xs uppercase tracking-wide">
                    <Clock className="h-3 w-3" /> {o.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StateCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[hsl(var(--hairline))] bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-[hsl(var(--content-subtle))]">
        {label}
      </div>
      <div className="mt-1 font-serif text-xl capitalize">{value}</div>
    </div>
  );
}
