import { useEffect, useMemo, useState } from "react";
import { Box, Layers3, Map as MapIcon } from "lucide-react";
import { GeoScene3D } from "@/components/geoscene";
import { SnapshotAwareProjectMap } from "@/components/geo/SnapshotAwareProjectMap";
import { useProjects } from "@/hooks/useProjects";
import {
  findProjectForProfile,
  getProjectViewerProfile,
  type CanonicalProjectKey,
} from "@/lib/geospatial/projectViewerProfiles";

type CanonicalViewerMode = "2d" | "3d";

export function CanonicalProjectViewer({
  profileKey,
  defaultMode = "2d",
  heightClassName = "h-[620px]",
  compactHeader = false,
}: {
  profileKey: CanonicalProjectKey;
  defaultMode?: CanonicalViewerMode;
  heightClassName?: string;
  compactHeader?: boolean;
}) {
  const { projects, active, setActiveId, loading } = useProjects();
  const [mode, setMode] = useState<CanonicalViewerMode>(defaultMode);
  const profile = getProjectViewerProfile(profileKey);

  const targetProject = useMemo(
    () => findProjectForProfile(projects, profileKey),
    [projects, profileKey],
  );

  useEffect(() => {
    if (targetProject && active?.id !== targetProject.id) {
      setActiveId(targetProject.id);
    }
  }, [active?.id, setActiveId, targetProject]);

  const ready = Boolean(targetProject && active?.id === targetProject.id);
  const activePreset = mode === "2d" ? profile.twoD : profile.threeD;

  if (loading) {
    return (
      <div
        className={`${heightClassName} grid place-items-center rounded border border-border bg-bg-secondary`}
      >
        <div className="font-mono text-xs text-muted-foreground">Cargando proyecto…</div>
      </div>
    );
  }

  if (!targetProject) {
    return (
      <div
        className={`${heightClassName} grid place-items-center rounded border border-border bg-bg-secondary p-6`}
      >
        <div className="max-w-md text-center">
          <div className="font-mono text-xs uppercase text-amber-500">Proyecto no disponible</div>
          <p className="mt-2 text-sm text-muted-foreground">
            El visor canónico necesita que el proyecto esté disponible en tu workspace para evitar
            mezclar capas de otra iniciativa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded border border-border bg-background"
      data-canonical-project-viewer={profile.key}
      data-geo-profile={profile.key}
      data-geo-mode={mode}
      data-geo-preset={activePreset}
      data-project-id={targetProject.id}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-secondary px-3 py-2.5">
        {!compactHeader && (
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-gold">
              <Layers3 className="h-3.5 w-3.5" />
              Canonical Geo Viewer
            </div>
            <div className="truncate text-sm font-semibold text-foreground">{profile.title}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{profile.subtitle}</div>
          </div>
        )}

        <div className="ml-auto inline-flex overflow-hidden rounded border border-border bg-background font-mono text-[10px] uppercase">
          <button
            type="button"
            onClick={() => setMode("2d")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${
              mode === "2d"
                ? "bg-gold text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapIcon className="h-3 w-3" />
            2D
          </button>
          <button
            type="button"
            onClick={() => setMode("3d")}
            className={`inline-flex items-center gap-1.5 border-l border-border px-3 py-1.5 ${
              mode === "3d"
                ? "bg-gold text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Box className="h-3 w-3" />
            3D
          </button>
        </div>
      </header>

      <div className={`relative ${heightClassName}`}>
        {!ready && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-background/90">
            <div className="font-mono text-xs text-muted-foreground">
              Activando {targetProject.name}…
            </div>
          </div>
        )}

        {ready && mode === "2d" && (
          <SnapshotAwareProjectMap preset={profile.twoD} profile={profile.key} />
        )}
        {ready && mode === "3d" && <GeoScene3D initialPreset={profile.threeD} />}
      </div>
    </section>
  );
}
