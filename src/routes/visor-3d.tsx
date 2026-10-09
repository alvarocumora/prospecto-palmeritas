import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MarketingPage } from "@/features/marketing/MarketingShell";
import { getPublicSatellite } from "@/lib/publicSatellite.functions";
import {
  findSatelliteProject,
  satelliteSelection,
  satelliteTerminalRedirect,
} from "@/lib/projects/navigation";

const SatelliteProjectScene = lazy(() =>
  import("@/features/satellite/SatelliteProjectScene").then((module) => ({
    default: module.SatelliteProjectScene,
  })),
);

export const Route = createFileRoute("/visor-3d")({
  validateSearch: satelliteSelection,
  beforeLoad: ({ search }) => {
    const target = satelliteTerminalRedirect(search);
    if (target) {
      throw redirect({
        to: "/terminal/$slug",
        params: { slug: target.slug },
        search: target.search,
        replace: true,
      });
    }
  },
  head: () => ({ meta: [{ title: "Visor satelital 3D — Geocapitals" }] }),
  component: SatelliteViewerPage,
});

function SatelliteViewerPage() {
  const selection = Route.useSearch();
  const fetchData = useServerFn(getPublicSatellite);
  const query = useQuery({
    queryKey: ["public-satellite"],
    queryFn: () => fetchData(),
    staleTime: 60_000,
  });
  const project = findSatelliteProject(query.data ?? [], selection.project);

  return (
    <MarketingPage eyebrow="Satelital" title={project?.name ?? "Visor satelital 3D"}>
      <Link
        to="/satelital"
        search={{ project: selection.project }}
        className="text-sm text-accent-brand hover:underline"
      >
        ← Volver a Satelital
      </Link>
      {query.isLoading ? (
        <p className="mt-6 text-sm text-content-subtle">Cargando proyecto…</p>
      ) : query.isError ? (
        <p className="mt-6 text-sm text-content-subtle">
          No fue posible cargar los datos satelitales. Intenta recargar la página.
        </p>
      ) : project ? (
        <Suspense fallback={<p className="mt-6 text-sm">Cargando relieve 3D…</p>}>
          <SatelliteProjectScene project={project} selection={selection} />
        </Suspense>
      ) : (
        <p className="mt-6 text-sm text-content-subtle">
          Este proyecto no tiene datos satelitales públicos disponibles.
        </p>
      )}
    </MarketingPage>
  );
}
