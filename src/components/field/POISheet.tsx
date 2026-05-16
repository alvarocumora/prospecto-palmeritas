import { useState } from "react";
import { Loader2, MapPin, Camera } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FIELD_POI_TYPES, type FieldPoiType, type NewFieldPoi } from "@/hooks/useFieldPois";
import { toast } from "sonner";

type Coords = { lat: number; lng: number; accuracy: number | null; elevation: number | null };

export function POISheet({
  open,
  onOpenChange,
  coords,
  online,
  projectId,
  organizationId,
  onSave,
  onQueue,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coords: Coords | null;
  online: boolean;
  projectId: string;
  organizationId: string;
  onSave: (p: NewFieldPoi) => Promise<void>;
  onQueue: (p: Omit<NewFieldPoi, "photo">) => void;
}) {
  const [type, setType] = useState<FieldPoiType>("outcrop");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setType("outcrop");
    setTitle("");
    setNote("");
    setPhoto(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coords) {
      toast.error("Sin coordenadas GPS");
      return;
    }
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    const base = {
      project_id: projectId,
      organization_id: organizationId,
      poi_type: type,
      title: title.trim(),
      note: note.trim() || null,
      lat: coords.lat,
      lng: coords.lng,
      accuracy_m: coords.accuracy,
      elevation_m: coords.elevation,
    };
    if (!online) {
      onQueue(base);
      toast.success("Sin conexión: punto encolado y sincronizará al recuperar señal");
      reset();
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...base, photo });
      toast.success("Punto guardado");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4 text-gold" />
            Nuevo punto de interés
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded border border-border bg-bg-secondary/40 p-2.5 text-[11px] font-mono">
            {coords ? (
              <>
                <div className="text-foreground">
                  {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                </div>
                <div className="text-muted-foreground mt-0.5">
                  Precisión: {coords.accuracy != null ? `±${Math.round(coords.accuracy)} m` : "—"}
                  {coords.elevation != null && ` · ${Math.round(coords.elevation)} msnm`}
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">Sin coordenadas</span>
            )}
            {!online && (
              <div className="mt-1 text-signal-amber">⚠ Offline — el punto se encolará</div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
              Tipo
            </label>
            <Select value={type} onValueChange={(v) => setType(v as FieldPoiType)}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_POI_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ background: t.color }}
                      />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              className="w-full h-11 px-3 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gold/50"
              placeholder="Ej. Veta cuarzo-pirita E-W"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
              Nota
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gold/50 resize-none"
              placeholder="Observaciones de campo, alteración, espesor, mineralogía…"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
              Foto (opcional)
            </label>
            <label className="flex items-center gap-2 h-11 px-3 rounded-md border border-dashed border-border bg-background cursor-pointer hover:bg-accent">
              <Camera className="w-4 h-4 text-gold" />
              <span className="text-sm font-mono text-muted-foreground truncate">
                {photo ? photo.name : "Tomar foto / elegir"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {photo && !online && (
              <p className="mt-1 text-[10px] text-signal-amber font-mono">
                Las fotos no se encolan offline; se omitirá si guardas sin conexión.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12 rounded-md border border-border bg-background text-sm font-mono active:scale-95 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !coords}
              className="flex-1 h-12 rounded-md bg-gold text-background text-sm font-mono font-semibold disabled:opacity-50 active:scale-95 transition inline-flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
              Guardar
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
