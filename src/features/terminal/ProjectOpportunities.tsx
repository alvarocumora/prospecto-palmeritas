import { ContactForm } from "@/features/marketing/ContactForm";
import { useState } from "react";
import { ListingDetailDrawer } from "@/modules/deals/ui/ListingDetailDrawer";
import { fmtUsd0 } from "@/lib/investor/fichas";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { getPublicListings } from "@/lib/publicListings.functions";

export function ProjectOpportunities({
  projectId,
  equityAmount,
  projectName,
}: {
  projectId?: string;
  equityAmount?: number;
  projectName?: string;
}) {
  const [inquiry, setInquiry] = useState<{ listingId: string; message: string } | null>(null);
  const fetchListings = useServerFn(getPublicListings);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-listings"],
    queryFn: () => fetchListings(),
    staleTime: 60_000,
    enabled: !!projectId,
  });
  const opportunities = (data?.listings ?? []).filter(
    (listing) => listing.project_id === projectId,
  );
  return (
    <section className="rounded-2xl border border-hairline bg-white p-6 space-y-4">
      <div className="flex gap-2 items-center">
        <LockKeyhole className="w-4 h-4 text-accent-brand" />
        <h2 className="font-display text-xl">Oportunidades y expediente privado</h2>
      </div>
      <p className="text-sm text-content-subtle">
        {equityAmount
          ? "Envía tu intención al titular de la oportunidad para revisar la disponibilidad y los términos."
          : "El acceso a documentos confidenciales requiere sesión, NDA y permisos del data room."}
      </p>
      {isLoading ? (
        <p role="status" className="text-sm text-content-subtle">
          Consultando oportunidades…
        </p>
      ) : opportunities.length ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {opportunities.map((listing) =>
            equityAmount ? (
              <button
                key={listing.id}
                type="button"
                className="rounded-xl border border-hairline p-4 text-left hover:border-accent-brand"
                onClick={() =>
                  setInquiry({
                    listingId: listing.id,
                    message: `Quisiera consultar por un aporte referencial de ${fmtUsd0(equityAmount)} en ${listing.title}.`,
                  })
                }
              >
                <span className="block font-medium">{listing.title}</span>
                <span className="block text-sm text-accent-brand mt-2">
                  Consultar por este monto
                </span>
              </button>
            ) : (
              <Link
                key={listing.id}
                to="/proyectos/$listingId"
                params={{ listingId: listing.id }}
                className="rounded-xl border border-hairline p-4 hover:border-accent-brand transition-colors"
              >
                <span className="block text-xs text-content-subtle">{listing.commodity}</span>
                <span className="block font-medium mt-1">{listing.title}</span>
                <span className="inline-flex items-center gap-2 text-sm text-accent-brand mt-3">
                  Revisar oportunidad y acceso <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            ),
          )}
        </div>
      ) : equityAmount && projectName ? (
        <details>
          <summary className="cursor-pointer text-sm text-accent-brand">
            Consultar disponibilidad al equipo Geocapitals
          </summary>
          <div className="mt-3">
            <ContactForm
              key={equityAmount}
              compact
              source="terminal-simulador"
              defaultRole="investor"
              defaultMessage={`Quisiera consultar por un aporte referencial de ${fmtUsd0(equityAmount)} en ${projectName}.`}
            />
          </div>
        </details>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-content-subtle">
            {isError
              ? "No pudimos consultar las oportunidades."
              : "Contacta al equipo para confirmar disponibilidad y acceso al expediente."}
          </p>
          <Link to="/contacto" className="text-sm text-accent-brand hover:underline">
            Contactar al equipo
          </Link>
        </div>
      )}
      {inquiry && (
        <ListingDetailDrawer
          listingId={inquiry.listingId}
          initialInquiry={inquiry.message}
          onClose={() => setInquiry(null)}
          onMutated={() => setInquiry(null)}
        />
      )}
    </section>
  );
}
