import { useRef, useState } from "react";
import { Upload, Loader2, FileImage, X } from "lucide-react";
import { toast } from "sonner";
import { uploadRasterFile, type DroneFlight } from "@/hooks/useDroneFlights";

const RASTER_TYPES = [
  { value: "ortho", label: "Ortomosaico (RGB)" },
  { value: "dsm", label: "DSM (modelo digital de superficie)" },
  { value: "dtm", label: "DTM (modelo digital del terreno)" },
  { value: "chm", label: "CHM (altura de canopia)" },
  { value: "ndvi", label: "NDVI (vegetación)" },
  { value: "thermal", label: "Térmico" },
  { value: "multispectral", label: "Multiespectral" },
  { value: "mag_grid", label: "Grid magnetometría" },
  { value: "dem", label: "DEM legado" },
];

interface Props {
  projectId: string;
  userId: string;
  flights: DroneFlight[];
  onClose: () => void;
  onSaved: () => void;
}

export function RasterUploader({ projectId, userId, flights, onClose, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("ortho");
  const [flightId, setFlightId] = useState<string>("");
  const [capturedAt, setCapturedAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<"idle" | "uploading" | "processing">("idle");

  const onFile = (f: File) => {
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Selecciona un archivo");
    if (!name.trim()) return toast.error("Nombre obligatorio");
    if (file.size > 50 * 1024 * 1024) return toast.error("El archivo supera 50 MB. Comprime u optimiza el GeoTIFF (ej: gdal_translate -co COMPRESS=DEFLATE).");

    setUploading(true);
    setStage("uploading");
    const { error } = await uploadRasterFile({
      projectId,
      userId,
      file,
      name: name.trim(),
      rasterType: type,
      flightId: flightId || null,
      capturedAt: capturedAt || null,
    });
    setStage("processing");
    setUploading(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Raster subido. Metadata GeoTIFF extraída.");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-mono font-semibold flex items-center gap-2">
            <FileImage className="w-4 h-4 text-gold" /> Subir raster (GeoTIFF / ortofoto)
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={onSubmit} className="p-4 space-y-3 text-xs font-mono">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full inline-flex flex-col items-center justify-center gap-2 px-3 py-6 rounded border border-dashed border-border bg-bg-secondary hover:bg-accent transition-colors"
          >
            <Upload className="w-5 h-5 text-gold" />
            <span className="font-semibold">{file ? file.name : "Selecciona GeoTIFF, PNG o JPG"}</span>
            {file && <span className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
            {!file && <span className="text-[10px] text-muted-foreground">Máx 50 MB · El CRS y bounds se extraen automáticamente del GeoTIFF</span>}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".tif,.tiff,.geotiff,.png,.jpg,.jpeg,image/tiff,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />

          <div>
            <label className="block text-[10px] uppercase text-muted-foreground mb-1">Nombre *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase text-muted-foreground mb-1">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary">
                {RASTER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-muted-foreground mb-1">Capturado</label>
              <input type="date" value={capturedAt} onChange={(e) => setCapturedAt(e.target.value)} className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase text-muted-foreground mb-1">Vuelo asociado (opcional)</label>
            <select value={flightId} onChange={(e) => setFlightId(e.target.value)} className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary">
              <option value="">— Ninguno —</option>
              {flights.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {uploading && (
            <div className="rounded border border-gold/40 bg-gold/5 px-3 py-2 flex items-center gap-2 text-gold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {stage === "uploading" ? "Subiendo a Storage…" : "Extrayendo metadata GeoTIFF…"}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={uploading} className="px-3 py-1.5 rounded border border-border text-muted-foreground hover:bg-accent disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={uploading || !file} className="px-3 py-1.5 rounded bg-gold text-bg-primary font-semibold hover:bg-gold-light disabled:opacity-50 inline-flex items-center gap-1.5">
              {uploading && <Loader2 className="w-3 h-3 animate-spin" />}
              {uploading ? "Procesando…" : "Subir raster"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
