import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Gavel,
  FileText,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCheck,
} from "lucide-react";
import {
  mergeLegalAlerts,
  summarizeLegalAlerts,
  type BulletinAlertInput,
  type CourtAlertInput,
  type LegalAlert,
  type LegalAlertKind,
} from "@/lib/legalAlerts";

type Filter = "all" | "unread" | LegalAlertKind;

const KIND_META: Record<
  LegalAlertKind,
  { label: string; icon: typeof Gavel; className: string; unreadClass: string }
> = {
  remate: {
    label: "Remate",
    icon: Gavel,
    className: "text-red-500",
    unreadClass: "border-red-500/40 bg-red-500/10",
  },
  pjud: {
    label: "PJUD",
    icon: AlertTriangle,
    className: "text-amber-500",
    unreadClass: "border-amber-500/40 bg-amber-500/10",
  },
  boletin: {
    label: "Boletín",
    icon: FileText,
    className: "text-sky-500",
    unreadClass: "border-sky-500/40 bg-sky-500/10",
  },
};

/**
 * Feed consolidado de alertas legales del proyecto (boletín + remate + PJUD).
 * Recibe las alertas ya cargadas y despacha el markRead a la tabla correcta.
 */
export function LegalAlertsFeed({
  bulletinAlerts,
  courtAlerts,
  onMarkBulletinRead,
  onMarkCourtRead,
  hasProject,
}: {
  bulletinAlerts: BulletinAlertInput[];
  courtAlerts: CourtAlertInput[];
  onMarkBulletinRead: (id: string) => void;
  onMarkCourtRead: (id: string) => void;
  hasProject: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const alerts = useMemo(
    () => mergeLegalAlerts(bulletinAlerts, courtAlerts),
    [bulletinAlerts, courtAlerts],
  );
  const summary = useMemo(() => summarizeLegalAlerts(alerts), [alerts]);

  const visible = useMemo(() => {
    if (filter === "all") return alerts;
    if (filter === "unread") return alerts.filter((a) => !a.isRead);
    return alerts.filter((a) => a.kind === filter);
  }, [alerts, filter]);

  const markRead = (a: LegalAlert) =>
    a.source === "bulletin" ? onMarkBulletinRead(a.alertId) : onMarkCourtRead(a.alertId);

  const markAllRead = () => {
    for (const a of alerts) if (!a.isRead) markRead(a);
  };

  if (!hasProject) {
    return (
      <div className="p-6 text-center text-text-secondary text-sm">
        Selecciona un proyecto para ver sus alertas legales.
      </div>
    );
  }

  const chips: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: "Todas", count: summary.total },
    { key: "unread", label: "No leídas", count: summary.unread },
    { key: "remate", label: "Remates", count: summary.remate },
    { key: "boletin", label: "Boletín", count: summary.boletin },
    { key: "pjud", label: "PJUD", count: summary.pjud },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`px-2.5 py-1 rounded text-xs border transition-colors ${
              filter === c.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-bg-secondary border-border hover:bg-accent"
            }`}
          >
            {c.label}
            <span className="ml-1 opacity-70">{c.count}</span>
          </button>
        ))}
        {summary.unread > 0 && (
          <button
            onClick={markAllRead}
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border border-border hover:bg-accent"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Marcar todas leídas
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="p-6 text-center text-text-secondary text-sm">
          {alerts.length === 0
            ? "Sin alertas legales todavía. Agrega titulares vigilados y ejecuta las sincronizaciones de Boletín, PJUD o la ingesta de remates."
            : "Sin alertas para este filtro."}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((a) => (
            <AlertRow key={a.key} alert={a} onToggleRead={() => markRead(a)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert: a, onToggleRead }: { alert: LegalAlert; onToggleRead: () => void }) {
  const meta = KIND_META[a.kind];
  const Icon = meta.icon;
  return (
    <div
      className={`border rounded p-3 ${a.isRead ? "border-border bg-bg-secondary/30" : meta.unreadClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Icon
              className={`w-4 h-4 shrink-0 ${a.isRead ? "text-text-secondary" : meta.className}`}
            />
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-bg-secondary border border-border">
              {meta.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-bg-secondary border border-border text-text-secondary">
              {a.badge}
            </span>
            <span className="text-xs text-text-secondary">
              {new Date(a.createdAt).toLocaleString("es-CL")}
            </span>
          </div>
          <div className="text-sm font-medium truncate">
            {a.title}
            {a.code && (
              <span className="text-text-secondary ml-1.5 font-mono text-xs">({a.code})</span>
            )}
          </div>
          <div className="text-xs text-text-secondary mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {a.holder && <span>👤 {a.holder}</span>}
            {a.location && <span>📍 {a.location}</span>}
            {a.year && <span>Nómina {a.year}</span>}
            {a.amountClp != null && (
              <span className="text-red-500 font-medium">
                Deuda ${a.amountClp.toLocaleString("es-CL")}
              </span>
            )}
          </div>
          {a.detail && (
            <div className="text-[11px] text-text-secondary mt-1">Coincidencia: {a.detail}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {a.sourceUrl && (
            <a
              href={a.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded hover:bg-accent text-primary"
              title="Ver fuente"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onToggleRead}
            className="p-1.5 rounded hover:bg-accent"
            title={a.isRead ? "Leída" : "Marcar leída"}
          >
            {a.isRead ? (
              <EyeOff className="w-4 h-4 text-text-secondary" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
