import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { testMiningEngine } from "@/lib/miningEngine.functions";

export const Route = createFileRoute("/diag/mining-engine")({
  component: DiagMiningEngine,
});

function DiagMiningEngine() {
  const run = useServerFn(testMiningEngine);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["diag-mining-engine"],
    queryFn: () => run(),
  });

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Diagnóstico mining-engine</h1>
      <button
        onClick={() => refetch()}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
        disabled={isFetching}
      >
        {isFetching ? "Probando…" : "Probar de nuevo"}
      </button>
      {isLoading && <p>Probando conexión…</p>}
      {error && <pre className="text-destructive">{String(error)}</pre>}
      {data && (
        <pre className="text-xs p-4 bg-muted rounded-md overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
