import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  useConcessionAlerts,
  ALERT_TYPE_LABEL,
  type ConcessionAlert,
} from "@/hooks/useConcessionAlerts";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const SEVERITY_STYLE: Record<string, { badge: string; icon: typeof AlertTriangle }> = {
  critical: { badge: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
  warning: { badge: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: AlertTriangle },
  info: { badge: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Bell },
};

export function ConcessionAlertsPanel({ projectId }: { projectId: string | null }) {
  const { alerts, unreadCount, criticalCount, markRead, markAllRead, triggerSync } =
    useConcessionAlerts(projectId);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "critical">("unread");

  const visible = useMemo(() => {
    if (filter === "unread") return alerts.filter((a) => !a.is_read);
    if (filter === "critical") return alerts.filter((a) => a.severity === "critical");
    return alerts;
  }, [alerts, filter]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await triggerSync();
      const r = res as { checked?: number; changed?: number; alertsCreated?: number } | null;
      toast.success(
        `Sync OK: ${r?.checked ?? 0} revisadas · ${r?.changed ?? 0} cambios · ${r?.alertsCreated ?? 0} alertas`,
      );
    } catch (e) {
      toast.error("Error sincronizando con SERNAGEOMIN");
      console.error(e);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Vigilancia catastral
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {unreadCount}
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge className="bg-red-500 text-white border-0">{criticalCount} críticas</Badge>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cambios detectados, vencimientos próximos y desapariciones del catastro oficial.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing || !projectId}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" onClick={markAllRead}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 text-xs">
        {(["unread", "critical", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 rounded border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent border-border hover:bg-muted"
            }`}
          >
            {f === "unread" ? "Sin leer" : f === "critical" ? "Críticas" : "Todas"}
          </button>
        ))}
      </div>

      <ScrollArea className="h-[320px] pr-2">
        {visible.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            Sin alertas en esta vista.
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((a) => (
              <AlertRow key={a.id} alert={a} onRead={markRead} />
            ))}
          </ul>
        )}
      </ScrollArea>
    </Card>
  );
}

function AlertRow({
  alert,
  onRead,
}: {
  alert: ConcessionAlert;
  onRead: (id: string) => void;
}) {
  const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.info;
  const Icon = style.icon;
  return (
    <li
      className={`p-2.5 rounded border text-xs flex items-start gap-2 ${
        alert.is_read ? "bg-card border-border opacity-70" : "bg-card border-primary/20"
      }`}
    >
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{alert.title}</span>
          <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${style.badge}`}>
            {ALERT_TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
          </Badge>
        </div>
        {alert.message && (
          <p className="text-muted-foreground mt-0.5 break-words">{alert.message}</p>
        )}
        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: es })}
        </div>
      </div>
      {!alert.is_read && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px]"
          onClick={() => onRead(alert.id)}
        >
          Leído
        </Button>
      )}
    </li>
  );
}
