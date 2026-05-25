import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  testMiningEngine,
  testCompositeEndpoint,
  testWireframeEndpoint,
} from "@/lib/miningEngine.functions";
import { testPitOptim } from "@/lib/pitOptim.functions";
import { testSchedule } from "@/lib/schedule.functions";

export const Route = createFileRoute("/diag/mining-engine")({
  component: DiagMiningEngine,
});

function DiagMiningEngine() {
  const run = useServerFn(testMiningEngine);
  const runComp = useServerFn(testCompositeEndpoint);
  const runWf = useServerFn(testWireframeEndpoint);
  const runPit = useServerFn(testPitOptim);
  const runSch = useServerFn(testSchedule);

  const health = useQuery({ queryKey: ["diag-mining-engine"], queryFn: () => run() });
  const composite = useQuery({
    queryKey: ["diag-mining-engine-composite"],
    queryFn: () => runComp(),
    enabled: false,
  });
  const wireframe = useQuery({
    queryKey: ["diag-mining-engine-wireframe"],
    queryFn: () => runWf(),
    enabled: false,
  });
  const pit = useQuery({
    queryKey: ["diag-pit-optim"],
    queryFn: () => runPit(),
    enabled: false,
  });

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Diagnóstico mining-engine</h1>

      <section className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">/health + /desurvey</h2>
          <button
            onClick={() => health.refetch()}
            className="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground"
            disabled={health.isFetching}
          >
            {health.isFetching ? "…" : "Probar"}
          </button>
        </div>
        {health.error && <pre className="text-destructive text-xs">{String(health.error)}</pre>}
        {health.data && (
          <pre className="text-xs p-3 bg-muted rounded-md overflow-auto">
            {JSON.stringify(health.data, null, 2)}
          </pre>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">/composite (sondaje real)</h2>
          <button
            onClick={() => composite.refetch()}
            className="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground"
            disabled={composite.isFetching}
          >
            {composite.isFetching ? "…" : "Probar"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Toma el sondaje con más drill_core_logs y compone a 2 m con recovery mín. 0.5.
        </p>
        {composite.error && (
          <pre className="text-destructive text-xs">{String(composite.error)}</pre>
        )}
        {composite.data && (
          <pre className="text-xs p-3 bg-muted rounded-md overflow-auto">
            {JSON.stringify(composite.data, null, 2)}
          </pre>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">/wireframe-rbf E2E + persistencia</h2>
          <button
            onClick={() => wireframe.refetch()}
            className="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground"
            disabled={wireframe.isFetching}
          >
            {wireframe.isFetching ? "…" : "Probar"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Elige el proyecto con más logs Au, construye samples (indicator Au ≥ 0.3 g/t), llama a
          Railway /wireframe-rbf (scipy + scikit-image), persiste en{" "}
          <code>geology_wireframes</code> y verifica la re-lectura.
        </p>
        {wireframe.error && (
          <pre className="text-destructive text-xs">{String(wireframe.error)}</pre>
        )}
        {wireframe.data && (
          <pre className="text-xs p-3 bg-muted rounded-md overflow-auto">
            {JSON.stringify(wireframe.data, null, 2)}
          </pre>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Pit Optimization (floating-cone)</h2>
          <button
            onClick={() => pit.refetch()}
            className="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground"
            disabled={pit.isFetching}
          >
            {pit.isFetching ? "…" : "Probar"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Toma el escenario económico más reciente con bloques estimados, computa valor por bloque
          (NSR − OPEX), corre floating-cone con el slope del escenario y persiste{" "}
          <code>resource_block_economics</code> + KPIs del pit en el escenario.
        </p>
        {pit.error && <pre className="text-destructive text-xs">{String(pit.error)}</pre>}
        {pit.data && (
          <pre className="text-xs p-3 bg-muted rounded-md overflow-auto">
            {JSON.stringify(pit.data, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
