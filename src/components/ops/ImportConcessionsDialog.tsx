import { useState } from "react";
import { Loader2, Download, CheckCircle2, XCircle, AlertCircle, SkipForward } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ImportResult = {
  code: string;
  status: "imported" | "skipped" | "failed" | "not_found";
  message?: string;
  id?: string;
};

type ImportResponse = {
  ok: boolean;
  imported: number;
  skipped: number;
  failed: number;
  notFound: number;
  results: ImportResult[];
};

export function ImportConcessionsDialog({
  open,
  onClose,
  projectId,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onImported: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const codes = raw
    .split(/[\n,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const onRun = async () => {
    if (codes.length === 0) {
      toast.error("Ingresa al menos un código");
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("import-concession", {
        body: { projectId, codes },
      });
      if (error) throw error;
      const r = data as ImportResponse;
      setResult(r);
      if (r.imported > 0) {
        toast.success(`${r.imported} concesión${r.imported === 1 ? "" : "es"} importada${r.imported === 1 ? "" : "s"} desde SERNAGEOMIN`);
        onImported();
      } else if (r.notFound === codes.length) {
        toast.error("Ninguno de los códigos fue encontrado en SERNAGEOMIN");
      } else {
        toast.message("Importación finalizada", {
          description: `${r.imported} OK · ${r.skipped} ya existían · ${r.notFound} no encontradas · ${r.failed} fallidas`,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error en importación");
    } finally {
      setRunning(false);
    }
  };

  const handleClose = () => {
    if (running) return;
    setRaw("");
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-signal-cyan" />
            Importar concesiones reales desde SERNAGEOMIN
          </DialogTitle>
          <DialogDescription>
            Pega los códigos o roles oficiales (uno por línea, o separados por coma). El sistema
            consulta el catastro oficial y trae geometría, titular, hectáreas y vigencia reales.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-text-dim">
              Códigos / roles ({codes.length})
            </label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              disabled={running}
              rows={8}
              placeholder={"Ejemplos:\n02101-2345-6\n02201-0789-K\n03101-1234-5"}
              className="w-full mt-1 p-2 text-sm font-mono bg-bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <p className="text-[11px] text-text-dim mt-1">
              Acepta CODIGO, ROL o COD_EXPED del catastro SERNAGEOMIN. Las concesiones que ya
              existan en este proyecto se omiten.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleClose}
              disabled={running}
              className="px-3 py-1.5 text-sm rounded border border-border hover:bg-accent disabled:opacity-50"
            >
              Cerrar
            </button>
            <button
              onClick={onRun}
              disabled={running || codes.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Importar {codes.length > 0 && `(${codes.length})`}
            </button>
          </div>

          {result && (
            <div className="border border-border rounded">
              <div className="grid grid-cols-4 gap-px bg-border text-center">
                <SummaryCell n={result.imported} label="Importadas" color="text-signal-green" />
                <SummaryCell n={result.skipped} label="Ya existían" color="text-text-dim" />
                <SummaryCell n={result.notFound} label="No encontradas" color="text-signal-amber" />
                <SummaryCell n={result.failed} label="Fallidas" color="text-destructive" />
              </div>
              <div className="max-h-[260px] overflow-y-auto divide-y divide-border">
                {result.results.map((r, i) => (
                  <div key={i} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                    <ResultIcon status={r.status} />
                    <span className="font-mono font-medium">{r.code}</span>
                    {r.message && <span className="text-text-dim truncate">— {r.message}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCell({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className="bg-bg-panel/40 py-2">
      <div className={`text-lg font-semibold font-mono ${color}`}>{n}</div>
      <div className="text-[10px] uppercase tracking-wider text-text-dim">{label}</div>
    </div>
  );
}

function ResultIcon({ status }: { status: ImportResult["status"] }) {
  if (status === "imported") return <CheckCircle2 className="w-3.5 h-3.5 text-signal-green shrink-0" />;
  if (status === "skipped") return <SkipForward className="w-3.5 h-3.5 text-text-dim shrink-0" />;
  if (status === "not_found") return <AlertCircle className="w-3.5 h-3.5 text-signal-amber shrink-0" />;
  return <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
}
