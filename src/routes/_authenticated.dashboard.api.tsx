import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Plus, Copy, Ban, Code2 } from "lucide-react";
import { createApiKey, listMyApiKeys, revokeApiKey } from "@/lib/apiKeys.functions";
import { API_PLAN_LIMITS } from "@/lib/apiKeys";

export const Route = createFileRoute("/_authenticated/dashboard/api")({
  head: () => ({ meta: [{ title: "API del catastro unificado — Geocapitals" }] }),
  component: ApiPage,
});

const CURL_EXAMPLE = `curl -H "x-api-key: TU_LLAVE" \\
  "https://geocapitals.com/api/v1/cadastre/search?country=PE&q=buenaventura&limit=10"`;

function ApiPage() {
  const createFn = useServerFn(createApiKey);
  const listFn = useServerFn(listMyApiKeys);
  const revokeFn = useServerFn(revokeApiKey);

  const { data: keys, refetch } = useQuery({
    queryKey: ["my-api-keys"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const onCreate = async () => {
    if (!name.trim()) {
      toast.error("Dale un nombre a la llave (ej. 'backend prod').");
      return;
    }
    setCreating(true);
    try {
      const { key } = await createFn({ data: { name: name.trim() } });
      setFreshKey(key);
      setName("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la llave.");
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (id: string) => {
    try {
      await revokeFn({ data: { id } });
      toast.success("Llave revocada.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo revocar.");
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copiado."),
      () => toast.error("No se pudo copiar."),
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">API del catastro unificado</h1>
        </div>
        <p className="text-xs text-text-secondary mt-1 max-w-2xl">
          Acceso programático al catastro minero multi-país (Chile, Perú, Brasil, Zambia) en el
          esquema canónico. Datos oficiales en vivo, normalizados. Cuota mensual por plan:{" "}
          {Object.entries(API_PLAN_LIMITS)
            .map(([p, l]) => `${p} ${l.toLocaleString("es-CL")}`)
            .join(" · ")}{" "}
          requests.
        </p>
      </div>

      {/* Crear llave */}
      <section className="rounded-md border border-border bg-bg-secondary/20 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs flex-1 min-w-[200px]">
            <span className="block text-text-secondary mb-1">Nombre de la llave</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. backend-prod"
              className="w-full px-2 py-1.5 bg-bg-primary border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <button
            onClick={() => void onCreate()}
            disabled={creating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Crear llave
          </button>
        </div>

        {freshKey && (
          <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="text-[11px] font-medium text-amber-700 mb-1">
              Guarda esta llave ahora — no volverá a mostrarse.
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono break-all flex-1">{freshKey}</code>
              <button
                onClick={() => copy(freshKey)}
                className="p-1.5 rounded border border-border hover:bg-accent shrink-0"
                title="Copiar"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Llaves existentes */}
      <section className="space-y-2">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">
          Mis llaves
        </h2>
        {!keys ? (
          <div className="h-16 rounded bg-muted/20 animate-pulse" />
        ) : keys.length === 0 ? (
          <div className="rounded-md border border-border p-6 text-center text-sm text-text-secondary">
            Sin llaves todavía. Crea la primera para usar el API.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="text-left text-text-secondary uppercase tracking-wider text-[10px] bg-bg-secondary/40 border-b border-border">
                <tr>
                  <th className="py-2 px-3">Nombre</th>
                  <th className="py-2 px-2">Llave</th>
                  <th className="py-2 px-2">Plan</th>
                  <th className="py-2 px-2 text-right">Uso mensual</th>
                  <th className="py-2 px-2 text-right">Total</th>
                  <th className="py-2 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-border last:border-0">
                    <td className="py-2 px-3 font-medium">{k.name}</td>
                    <td className="py-2 px-2 font-mono text-text-secondary">{k.key_prefix}…</td>
                    <td className="py-2 px-2">{k.plan}</td>
                    <td className="py-2 px-2 text-right">
                      {k.monthly_count.toLocaleString("es-CL")}
                    </td>
                    <td className="py-2 px-2 text-right text-text-secondary">
                      {k.requests_total.toLocaleString("es-CL")}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {k.is_active ? (
                        <button
                          onClick={() => void onRevoke(k.id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:underline"
                        >
                          <Ban className="w-3 h-3" /> Revocar
                        </button>
                      ) : (
                        <span className="text-text-secondary">Revocada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Docs */}
      <section className="rounded-md border border-border bg-bg-secondary/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Code2 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-mono uppercase tracking-wider">Uso</h2>
        </div>
        <pre className="text-[11px] font-mono bg-bg-primary border border-border rounded p-3 overflow-x-auto whitespace-pre-wrap">
          {CURL_EXAMPLE}
        </pre>
        <ul className="mt-3 text-xs text-text-secondary space-y-1">
          <li>
            · <code>country</code>: CL · PE · BR · ZM — <code>q</code>: titular, nombre, código o
            commodity — <code>limit</code>: máx. 50.
          </li>
          <li>
            · Respuesta: <code>{"{ data: CanonicalConcession[], meta }"}</code> con estado
            normalizado (<code>active/pending/extinct</code>), hectáreas, commodity y vencimiento
            cuando la fuente los publica.
          </li>
          <li>· Errores: 401 llave inválida · 403 revocada · 429 cuota mensual excedida.</li>
        </ul>
      </section>
    </div>
  );
}
