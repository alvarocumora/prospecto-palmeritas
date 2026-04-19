// Sprint 6.1 — ToolDock: dock vertical unificado para herramientas del Centro de Operaciones.
// Reemplaza los 5 botones flotantes dispersos por una barra ordenada a la derecha,
// colapsable, con tooltips y badges de estado.

import { useState, type ReactNode } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

export interface ToolDockItem {
  id: string;
  icon: ReactNode;
  label: string;
  /** Render del trigger real de la herramienta (botón, dialog, panel). */
  render: (compact: boolean) => ReactNode;
  /** Pequeño badge opcional (ej: "3", "•"). */
  badge?: string | number;
  /** Resalta el item si la herramienta está activa. */
  active?: boolean;
}

interface Props {
  items: ToolDockItem[];
}

export function ToolDock({ items }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`absolute top-4 right-4 z-[1000] flex flex-col bg-bg-secondary/95 backdrop-blur border border-border rounded-lg shadow-xl transition-all ${
        expanded ? "w-56" : "w-11"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-border text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-t-lg transition-colors"
        title={expanded ? "Colapsar herramientas" : "Expandir herramientas"}
      >
        {expanded && (
          <span className="text-[10px] font-mono uppercase tracking-wider">Herramientas</span>
        )}
        {expanded ? (
          <ChevronRight className="w-3.5 h-3.5 ml-auto" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 mx-auto" />
        )}
      </button>

      <div className="flex flex-col p-1.5 gap-1">
        {items.map((item) => (
          <ToolSlot key={item.id} item={item} expanded={expanded} />
        ))}
      </div>
    </div>
  );
}

function ToolSlot({ item, expanded }: { item: ToolDockItem; expanded: boolean }) {
  return (
    <div
      className={`relative group rounded transition-colors ${
        item.active ? "bg-gold/15 ring-1 ring-gold/40" : "hover:bg-accent/40"
      }`}
      title={!expanded ? item.label : undefined}
    >
      <div className={`flex items-center ${expanded ? "gap-2 px-1.5" : "justify-center"}`}>
        <div className="shrink-0 [&>button]:!relative [&>button]:!top-auto [&>button]:!right-auto [&>button]:!left-auto [&>button]:!bottom-auto [&>button]:!shadow-none [&>button]:!border-0 [&>button]:!bg-transparent [&>button]:hover:!bg-transparent [&>button]:!w-8 [&>button]:!h-8 [&>button]:!p-0 [&>button]:!rounded">
          {item.render(!expanded)}
        </div>
        {expanded && (
          <span className="text-[11px] font-mono text-foreground truncate flex-1">{item.label}</span>
        )}
        {item.badge !== undefined && (
          <span className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-gold text-background mr-1">
            {item.badge}
          </span>
        )}
      </div>
    </div>
  );
}
