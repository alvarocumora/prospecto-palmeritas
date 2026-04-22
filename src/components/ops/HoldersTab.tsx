import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useHolders } from "@/hooks/useHolders";
import { HolderCard } from "./HolderCard";
import { HolderEditDialog } from "./HolderEditDialog";

export function HoldersTab({ projectId, userId }: { projectId: string; userId: string }) {
  const { data, loading, refresh } = useHolders(projectId);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter(
      (h) => h.name.toLowerCase().includes(s) || (h.rut && h.rut.toLowerCase().includes(s)),
    );
  }, [data, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o RUT…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-bg-secondary border border-border rounded"
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo titular
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-text-secondary border border-border rounded">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-center text-sm text-text-secondary border border-border rounded">
          {data.length === 0 ? "Sin titulares todavía. Crea el primero." : "Sin resultados."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filtered.map((h) => (
            <HolderCard key={h.id} holder={h} />
          ))}
        </div>
      )}

      {creating && (
        <HolderEditDialog
          holder={null}
          projectId={projectId}
          userId={userId}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); refresh(); }}
        />
      )}
    </div>
  );
}
