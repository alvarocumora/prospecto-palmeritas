/* eslint-disable react-refresh/only-export-components */
import { CheckCircle2, Clock, Eye, Archive } from "lucide-react";

export type RecordStatus = "draft" | "review" | "approved" | "archived";

const STATUS_META: Record<RecordStatus, { label: string; color: string; Icon: typeof Clock }> = {
  draft: {
    label: "Borrador",
    color: "text-muted-foreground border-border bg-muted/30",
    Icon: Clock,
  },
  review: { label: "Revisión", color: "text-gold border-gold/30 bg-gold/10", Icon: Eye },
  approved: { label: "Aprobado", color: "text-teal border-teal/30 bg-teal/10", Icon: CheckCircle2 },
  archived: {
    label: "Archivado",
    color: "text-muted-foreground border-border bg-muted/20 line-through",
    Icon: Archive,
  },
};

export function RecordStatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "xs" }) {
  const meta = STATUS_META[status as RecordStatus] ?? STATUS_META.draft;
  const Icon = meta.Icon;
  const sz = size === "xs" ? "text-[9px] px-1 py-0" : "text-[10px] px-1.5 py-0.5";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-mono uppercase ${sz} ${meta.color}`}
    >
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}

export const RECORD_STATUSES: RecordStatus[] = ["draft", "review", "approved", "archived"];