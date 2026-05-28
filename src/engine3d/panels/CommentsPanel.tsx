// CommentsPanel — Sprint 6
// Panel reutilizable de comentarios sobre entidades del engine.
import { useState } from "react";
import { MessageSquare, Check, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useEngineComments } from "@/engine3d/persistence/useEngineComments";
import { useEngineRole } from "@/engine3d/hooks/useEngineRole";
import type { EngineCommentRow } from "@/engine3d/persistence/engineCloud";

type Props = {
  projectId: string;
  entityType: EngineCommentRow["entity_type"];
  entityId: string;
  title?: string;
  onClose?: () => void;
};

const STATUS_COLOR: Record<EngineCommentRow["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

export function CommentsPanel({ projectId, entityType, entityId, title, onClose }: Props) {
  const { comments, loading, add, setStatus, remove } = useEngineComments(
    projectId,
    entityType,
    entityId,
  );
  const { can } = useEngineRole();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const canWrite = can("comments.write");
  const canModerate = can("comments.moderate");

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      await add({ body: text, status: "draft" });
      setBody("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-30 w-[380px] max-h-[60vh] bg-black/85 backdrop-blur border border-border rounded-md p-3 flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-300" />
          <span className="font-mono uppercase tracking-wider">
            {title ?? `${entityType} comments`}
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[10px]">
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading && <p className="text-muted-foreground">Cargando…</p>}
        {!loading && comments.length === 0 && (
          <p className="text-muted-foreground italic">Sin comentarios aún.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="border border-border rounded p-2 bg-white/5">
            <div className="flex items-center justify-between mb-1">
              <Badge variant="outline" className={`text-[9px] ${STATUS_COLOR[c.status]}`}>
                {c.status}
              </Badge>
              <span className="text-[9px] text-muted-foreground font-mono">
                {new Date(c.created_at).toLocaleString()}
              </span>
            </div>
            <p className="text-foreground whitespace-pre-wrap break-words">{c.body}</p>
            <div className="flex gap-1 mt-1.5">
              {canModerate && c.status !== "review" && (
                <button
                  onClick={() => setStatus({ id: c.id, status: "review" })}
                  className="text-[10px] flex items-center gap-1 text-amber-300 hover:underline"
                >
                  <Eye className="w-3 h-3" /> review
                </button>
              )}
              {canModerate && c.status !== "approved" && (
                <button
                  onClick={() => setStatus({ id: c.id, status: "approved" })}
                  className="text-[10px] flex items-center gap-1 text-emerald-300 hover:underline"
                >
                  <Check className="w-3 h-3" /> approve
                </button>
              )}
              {(canModerate || canWrite) && (
                <button
                  onClick={() => remove(c.id)}
                  className="text-[10px] flex items-center gap-1 text-red-300 hover:underline ml-auto"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canWrite ? (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe un comentario… usa @ para mencionar (próximamente)"
            rows={2}
            className="text-xs"
          />
          <Button size="sm" disabled={busy || !body.trim()} onClick={submit}>
            {busy ? "Enviando…" : "Comentar"}
          </Button>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic border-t border-border pt-2">
          Tu rol no permite comentar.
        </p>
      )}
    </div>
  );
}
