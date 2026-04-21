import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusDot, type SignalStatus } from "./StatusDot";
import { cn } from "@/lib/utils";

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  user_id: string | null;
};

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function actionStatus(action: string): SignalStatus {
  const a = action.toLowerCase();
  if (a.includes("delete") || a.includes("reject") || a.includes("fail")) return "crit";
  if (a.includes("approve") || a.includes("complete")) return "ok";
  if (a.includes("warn") || a.includes("expire") || a.includes("alert")) return "warn";
  if (a.includes("ai") || a.includes("predict")) return "ai";
  return "live";
}

export function ActivityTicker({
  projectId,
  limit = 12,
  className,
}: {
  projectId: string | null;
  limit?: number;
  className?: string;
}) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("audit_log")
      .select("id, action, entity_type, entity_id, created_at, user_id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data }) => {
        if (cancelled) return;
        setRows((data ?? []) as AuditRow[]);
        setLoading(false);
      });

    const channel = supabase
      .channel(`audit-ticker-${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log", filter: `project_id=eq.${projectId}` },
        (payload) => {
          setRows((prev) => [payload.new as AuditRow, ...prev].slice(0, limit));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [projectId, limit]);

  if (!projectId) {
    return <div className={cn("font-mono text-[11px] text-text-dim", className)}>[ NO PROJECT · SELECT TO STREAM ]</div>;
  }
  if (loading) {
    return <div className={cn("skeleton-mono text-[11px]", className)}>▒▒▒▒ STREAMING AUDIT ▒▒▒▒</div>;
  }
  if (rows.length === 0) {
    return <div className={cn("font-mono text-[11px] text-text-dim", className)}>[ NO ACTIVITY · STANDING BY ]</div>;
  }
  return (
    <ul className={cn("font-mono text-[11px] space-y-1", className)}>
      {rows.map((r) => {
        const s = actionStatus(r.action);
        return (
          <li key={r.id} className="flex items-start gap-2 group">
            <span className="text-text-dim tabular-nums w-9 shrink-0">{relativeTime(r.created_at)}</span>
            <StatusDot status={s} className="mt-0.5" />
            <span className="text-text-mono truncate flex-1">
              <span className="uppercase text-[10px] tracking-wider mr-1.5">{r.action}</span>
              <span className="text-text-dim">{r.entity_type}</span>
              {r.entity_id && <span className="text-text-dim/60"> · {r.entity_id.slice(0, 8)}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
