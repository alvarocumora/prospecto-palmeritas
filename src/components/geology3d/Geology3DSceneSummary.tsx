import { structuresToScene } from "@/lib/geology3d/sceneAdapter";
import type { Geology3DStructure } from "@/types/geology3d";

type Geology3DSceneSummaryProps = {
  structures: Geology3DStructure[];
};

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

export function Geology3DSceneSummary({ structures }: Geology3DSceneSummaryProps) {
  const sceneObjects = structuresToScene(structures);

  if (sceneObjects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        No hay estructuras 3D disponibles para la escena.
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Geology 3D Scene</div>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Estructuras listas para render</h3>
        </div>
        <div className="rounded-md border border-border bg-background px-3 py-2 text-right">
          <div className="font-mono text-xs uppercase text-muted-foreground">Objects</div>
          <div className="text-xl font-semibold text-foreground">{sceneObjects.length}</div>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sceneObjects.map((object) => (
          <article key={object.id} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {object.type.replaceAll("_", " ")}
                </div>
                <h4 className="mt-1 truncate text-sm font-semibold text-foreground">{object.name}</h4>
              </div>
              <span
                className="h-4 w-4 rounded-full border border-border shrink-0"
                style={{ backgroundColor: object.color, opacity: object.opacity }}
                aria-label={`Color ${object.color}`}
              />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
              <div>
                <dt>Centroid X</dt>
                <dd className="text-foreground">{formatNumber(object.centroid[0])}</dd>
              </div>
              <div>
                <dt>Centroid Y</dt>
                <dd className="text-foreground">{formatNumber(object.centroid[1])}</dd>
              </div>
              <div>
                <dt>Centroid Z</dt>
                <dd className="text-foreground">{formatNumber(object.centroid[2])}</dd>
              </div>
              <div>
                <dt>Vertices</dt>
                <dd className="text-foreground">{object.vertices.length}</dd>
              </div>
              <div>
                <dt>Width</dt>
                <dd className="text-foreground">{formatNumber(object.bounds.width)}</dd>
              </div>
              <div>
                <dt>Depth</dt>
                <dd className="text-foreground">{formatNumber(object.bounds.depth)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
