import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { getPublicListings } from "@/lib/publicListings.functions";

export function ProjectOpportunities({ projectId }: { projectId?: string }) {
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
        El acceso a documentos confidenciales se gestiona en la oportunidad correspondiente, con
        sesión, NDA y permisos del data room.
      </p>
      {isLoading ? (
        <p role="status" className="text-sm text-content-subtle">
          Consultando oportunidades…
        </p>
      ) : opportunities.length ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {opportunities.map((listing) => (
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
          ))}
        </div>
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
    </section>
  );
}
