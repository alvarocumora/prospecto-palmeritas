import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportSatelliteIntelPdf } from "@/lib/exportSatelliteIntelPdf";

interface Props {
  projectName: string;
  getSections: () => Array<{ id: string; title: string; element: HTMLElement | null }>;
  getAnnexes?: () => Array<{ title: string; rows: Array<[string, string]> }>;
}

export function SatelliteIntelPdfExport({ projectName, getSections, getAnnexes }: Props) {
  const [busy, setBusy] = useState(false);
  const triggered = useRef(false);

  const handleExport = async () => {
    if (triggered.current) return;
    triggered.current = true;
    setBusy(true);
    try {
      const sections = getSections();
      const annexes = getAnnexes?.() ?? [];
      const blob = await exportSatelliteIntelPdf({ projectName, sections, annexes });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Inteligencia_Satelital_${projectName.replace(/\s+/g, "_")}_${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF generado");
    } catch (e) {
      console.error(e);
      toast.error("Error generando PDF: " + (e as Error).message);
    } finally {
      setBusy(false);
      triggered.current = false;
    }
  };

  return (
    <Button onClick={handleExport} disabled={busy} size="sm" variant="outline" className="font-mono uppercase tracking-wider text-xs">
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
      {busy ? "Generando PDF…" : "Exportar PDF"}
    </Button>
  );
}
