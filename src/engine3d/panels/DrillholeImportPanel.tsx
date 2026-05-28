// Panel para importar CSVs de sondajes (collar/survey/assay/lithology).
// Parsea en cliente y entrega bundle al engine. La persistencia a DB queda
// para una fase posterior (server fn dedicado).
import { useState, useRef } from "react";
import { Upload, X, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildBundle, type ParsedDrillholeBundle } from "@/engine3d/data/csvDrillholes";

type Kind = "collar" | "survey" | "assay" | "lithology";

type Props = {
  onImport: (bundle: ParsedDrillholeBundle) => void;
  onClose: () => void;
};

export function DrillholeImportPanel({ onImport, onClose }: Props) {
  const [texts, setTexts] = useState<Record<Kind, string | null>>({
    collar: null, survey: null, assay: null, lithology: null,
  });
  const [filenames, setFilenames] = useState<Record<Kind, string | null>>({
    collar: null, survey: null, assay: null, lithology: null,
  });
  const [bundle, setBundle] = useState<ParsedDrillholeBundle | null>(null);

  const refs: Record<Kind, React.RefObject<HTMLInputElement>> = {
    collar: useRef<HTMLInputElement>(null),
    survey: useRef<HTMLInputElement>(null),
    assay: useRef<HTMLInputElement>(null),
    lithology: useRef<HTMLInputElement>(null),
  };

  const onFile = (kind: Kind, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setTexts((t) => ({ ...t, [kind]: text }));
      setFilenames((f) => ({ ...f, [kind]: file.name }));
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    const b = buildBundle({
      collarText: texts.collar ?? undefined,
      surveyText: texts.survey ?? undefined,
      assayText: texts.assay ?? undefined,
      lithText: texts.lithology ?? undefined,
    });
    setBundle(b);
  };

  const handleImport = () => {
    if (!bundle) return;
    onImport(bundle);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg text-[11px] font-mono">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-amber-300 uppercase tracking-wider">
            <Upload className="w-3.5 h-3.5" /> Import drillholes — CSV
          </div>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="p-4 space-y-3">
          {(["collar", "survey", "assay", "lithology"] as Kind[]).map((k) => (
            <div key={k} className="flex items-center justify-between gap-3 border border-border/60 rounded p-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="uppercase text-foreground">{k}{k === "collar" && " *"}</div>
                  <div className="text-muted-foreground truncate text-[10px]">
                    {filenames[k] ?? "sin archivo"}
                  </div>
                </div>
              </div>
              <input
                ref={refs[k]}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onFile(k, e.target.files?.[0] ?? null)}
              />
              <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => refs[k].current?.click()}>
                Select
              </Button>
            </div>
          ))}
          {bundle && (
            <div className="bg-black/40 border border-emerald-500/30 rounded p-2 space-y-0.5">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-3 h-3" /> Parsed
              </div>
              <div className="text-muted-foreground">
                {bundle.collars.length} collars · {bundle.surveys.length} surveys ·{" "}
                {bundle.assays.length} assays · {bundle.lithology.length} lith
              </div>
              {bundle.errors.length > 0 && (
                <div className="text-amber-300 mt-1">⚠ {bundle.errors.length} avisos</div>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-[10px]"
              disabled={!texts.collar}
              onClick={handleParse}
            >
              Parse
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8 text-[10px]"
              disabled={!bundle || bundle.collars.length === 0}
              onClick={handleImport}
            >
              Import to engine
            </Button>
          </div>
          <div className="text-[9px] text-muted-foreground italic">
            Formato: hole_id, x/easting, y/northing, z/elevation (collar); hole_id, depth, azimuth, dip (survey); hole_id, from, to, grade (assay).
          </div>
        </div>
      </div>
    </div>
  );
}
