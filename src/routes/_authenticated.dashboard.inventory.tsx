import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useProjectRole, canWrite } from "@/hooks/useProjectRole";
import {
  useCoreInventory,
  BOX_STATUS_META,
  CONDITION_META,
  CUSTODY_EVENT_META,
  type CoreBox,
  type CoreBoxStatus,
  type CoreBoxCondition,
  type CustodyEvent,
} from "@/hooks/useCoreInventory";
import { Boxes, Plus, Trash2, X, Package, Truck, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/inventory")({
  head: () => ({ meta: [{ title: "Inventario · Cores & Custodia — Trackmin" }] }),
  component: InventoryPage,
});

const TABS = ["boxes", "custody"] as const;
type Tab = (typeof TABS)[number];

function InventoryPage() {
  const { active } = useProjects();
  const role = useProjectRole();
  const { boxes, custody, loading, addBox, updateBox, deleteBox, addCustodyEvent } =
    useCoreInventory(active?.id ?? null);
  const [tab, setTab] = useState<Tab>("boxes");
  const [showBoxForm, setShowBoxForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const writable = canWrite(role);

  const stats = useMemo(
    () => ({
      total: boxes.length,
      stored: boxes.filter((b) => b.status === "stored").length,
      inTransit: boxes.filter((b) => b.status === "in_transit").length,
      damaged: boxes.filter((b) => b.condition !== "good").length,
      custodyEvents: custody.length,
    }),
    [boxes, custody],
  );

  if (!active)
    return <div className="p-8 text-sm text-muted-foreground">Selecciona un proyecto.</div>;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto pb-20 md:pb-8">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
            Proyecto · {active.code}
          </div>
          <h1 className="text-xl md:text-2xl font-bold mt-1 inline-flex items-center gap-2">
            <Boxes className="w-5 h-5 text-gold" /> Inventario físico
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Cajas de testigos almacenadas y cadena de custodia de muestras (chain-of-custody NI
            43-101).
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Stat label="Cajas totales" value={String(stats.total)} />
        <Stat label="Almacenadas" value={String(stats.stored)} color="text-info" />
        <Stat label="En tránsito" value={String(stats.inTransit)} color="text-copper" />
        <Stat
          label="No conformes"
          value={String(stats.damaged)}
          color={stats.damaged > 0 ? "text-destructive" : "text-foreground"}
        />
        <Stat label="Eventos custodia" value={String(stats.custodyEvents)} color="text-gold" />
      </div>

      <div className="border-b border-border mb-4 flex items-center justify-between">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
                tab === t
                  ? "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "boxes"
                ? `Cajas de testigos (${boxes.length})`
                : `Cadena de custodia (${custody.length})`}
            </button>
          ))}
        </div>
        {writable && (
          <button
            type="button"
            onClick={() => (tab === "boxes" ? setShowBoxForm(true) : setShowEventForm(true))}
            className="px-3 py-1.5 text-xs font-mono rounded border border-gold/40 text-gold bg-gold/5 hover:bg-gold/10 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3 h-3" /> {tab === "boxes" ? "Nueva caja" : "Registrar evento"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : tab === "boxes" ? (
        <BoxesTable boxes={boxes} writable={writable} onUpdate={updateBox} onDelete={deleteBox} />
      ) : (
        <CustodyTable events={custody} />
      )}

      {showBoxForm && (
        <BoxDialog
          onClose={() => setShowBoxForm(false)}
          onSaved={async (b) => {
            const { error } = await addBox(b);
            if (error) toast.error(error);
            else {
              toast.success("Caja registrada");
              setShowBoxForm(false);
            }
          }}
        />
      )}
      {showEventForm && (
        <EventDialog
          onClose={() => setShowEventForm(false)}
          onSaved={async (e) => {
            const { error } = await addCustodyEvent(e);
            if (error) toast.error(error);
            else {
              toast.success("Evento registrado");
              setShowEventForm(false);
            }
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded border border-border bg-bg-secondary p-3">
      <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-mono font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function BoxesTable({
  boxes,
  writable,
  onUpdate,
  onDelete,
}: {
  boxes: CoreBox[];
  writable: boolean;
  onUpdate: (id: string, patch: Partial<CoreBox>) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
}) {
  if (boxes.length === 0) {
    return (
      <div className="rounded border border-dashed border-border bg-bg-secondary p-12 text-center">
        <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
        <div className="font-mono text-sm">Sin cajas registradas</div>
        <p className="text-xs text-muted-foreground mt-1">
          Registra la primera caja con su sondaje, intervalo y ubicación física.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded border border-border bg-bg-secondary overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead className="bg-background border-b border-border">
          <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">N°</th>
            <th className="px-3 py-2">Intervalo (m)</th>
            <th className="px-3 py-2">Ubicación</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Condición</th>
            {writable && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {boxes.map((b) => (
            <tr key={b.id} className="border-b border-border/50 hover:bg-accent/30">
              <td className="px-3 py-2 font-semibold text-foreground">{b.box_code}</td>
              <td className="px-3 py-2 text-muted-foreground">{b.box_number ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {b.depth_from != null && b.depth_to != null ? `${b.depth_from}–${b.depth_to}` : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {[b.storage_location, b.rack, b.shelf, b.position].filter(Boolean).join(" · ") ||
                  "—"}
              </td>
              <td className="px-3 py-2">
                {writable ? (
                  <select
                    className="bg-transparent border border-border rounded px-1.5 py-0.5 text-[10px]"
                    value={b.status}
                    onChange={async (e) => {
                      const { error } = await onUpdate(b.id, {
                        status: e.target.value as CoreBoxStatus,
                      });
                      if (error) toast.error(error);
                    }}
                  >
                    {(Object.keys(BOX_STATUS_META) as CoreBoxStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {BOX_STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${BOX_STATUS_META[b.status].color}`}
                  >
                    {BOX_STATUS_META[b.status].label}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${CONDITION_META[b.condition].color}`}
                >
                  {CONDITION_META[b.condition].label}
                </span>
              </td>
              {writable && (
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`¿Eliminar caja ${b.box_code}?`)) return;
                      const { error } = await onDelete(b.id);
                      if (error) toast.error(error);
                      else toast.success("Eliminada");
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustodyTable({ events }: { events: ReturnType<typeof useCoreInventory>["custody"] }) {
  if (events.length === 0) {
    return (
      <div className="rounded border border-dashed border-border bg-bg-secondary p-12 text-center">
        <Truck className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
        <div className="font-mono text-sm">Sin eventos de custodia</div>
        <p className="text-xs text-muted-foreground mt-1">
          Cada movimiento físico de muestra debe registrarse aquí (recolección, envío, recepción en
          lab, etc.).
        </p>
      </div>
    );
  }
  return (
    <div className="rounded border border-border bg-bg-secondary overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead className="bg-background border-b border-border">
          <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2">Fecha</th>
            <th className="px-3 py-2">Muestra</th>
            <th className="px-3 py-2">Evento</th>
            <th className="px-3 py-2">Ubicación</th>
            <th className="px-3 py-2">Carrier / Waybill</th>
            <th className="px-3 py-2">Sello</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-border/50 hover:bg-accent/30">
              <td className="px-3 py-2 text-muted-foreground">
                {new Date(e.event_at).toLocaleString()}
              </td>
              <td className="px-3 py-2 font-semibold text-foreground">{e.sample_code}</td>
              <td className={`px-3 py-2 ${CUSTODY_EVENT_META[e.event_type].color}`}>
                {CUSTODY_EVENT_META[e.event_type].label}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{e.location ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {e.carrier ? `${e.carrier}${e.waybill ? ` · ${e.waybill}` : ""}` : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{e.seal_number ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoxDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (b: Partial<CoreBox> & { box_code: string }) => void;
}) {
  const [box_code, setBoxCode] = useState("");
  const [box_number, setBoxNumber] = useState("");
  const [depth_from, setFrom] = useState("");
  const [depth_to, setTo] = useState("");
  const [storage_location, setLoc] = useState("");
  const [rack, setRack] = useState("");
  const [shelf, setShelf] = useState("");
  const [position, setPos] = useState("");
  const [status, setStatus] = useState<CoreBoxStatus>("stored");
  const [condition, setCondition] = useState<CoreBoxCondition>("good");
  const [notes, setNotes] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-mono text-sm font-semibold inline-flex items-center gap-2">
            <Boxes className="w-4 h-4 text-gold" /> Nueva caja de testigos
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!box_code.trim()) {
              toast.error("Código requerido");
              return;
            }
            onSaved({
              box_code: box_code.trim().toUpperCase(),
              box_number: box_number ? Number(box_number) : null,
              depth_from: depth_from ? Number(depth_from) : null,
              depth_to: depth_to ? Number(depth_to) : null,
              storage_location: storage_location || null,
              rack: rack || null,
              shelf: shelf || null,
              position: position || null,
              status,
              condition,
              notes: notes || null,
            });
          }}
          className="p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código caja" required>
              <input
                className="input"
                value={box_code}
                onChange={(e) => setBoxCode(e.target.value)}
                placeholder="DDH-001-B12"
                required
              />
            </Field>
            <Field label="N° caja">
              <input
                className="input"
                type="number"
                value={box_number}
                onChange={(e) => setBoxNumber(e.target.value)}
                placeholder="12"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Profundidad desde (m)">
              <input
                className="input"
                type="number"
                step="any"
                value={depth_from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="Profundidad hasta (m)">
              <input
                className="input"
                type="number"
                step="any"
                value={depth_to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Almacén">
            <input
              className="input"
              value={storage_location}
              onChange={(e) => setLoc(e.target.value)}
              placeholder="Bodega Central — Calama"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Rack">
              <input
                className="input"
                value={rack}
                onChange={(e) => setRack(e.target.value)}
                placeholder="R-04"
              />
            </Field>
            <Field label="Estante">
              <input
                className="input"
                value={shelf}
                onChange={(e) => setShelf(e.target.value)}
                placeholder="E-2"
              />
            </Field>
            <Field label="Posición">
              <input
                className="input"
                value={position}
                onChange={(e) => setPos(e.target.value)}
                placeholder="P-15"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estado">
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as CoreBoxStatus)}
              >
                {(Object.keys(BOX_STATUS_META) as CoreBoxStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {BOX_STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Condición">
              <select
                className="input"
                value={condition}
                onChange={(e) => setCondition(e.target.value as CoreBoxCondition)}
              >
                {(Object.keys(CONDITION_META) as CoreBoxCondition[]).map((c) => (
                  <option key={c} value={c}>
                    {CONDITION_META[c].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notas">
            <textarea
              className="input min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-mono rounded border border-border hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-mono rounded bg-gold text-background hover:bg-gold/90"
            >
              Crear
            </button>
          </div>
        </form>
      </div>
      <DialogStyles />
    </div>
  );
}

function EventDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (e: {
    sample_code: string;
    event_type: CustodyEvent;
    location?: string | null;
    carrier?: string | null;
    waybill?: string | null;
    seal_number?: string | null;
    notes?: string | null;
  }) => void;
}) {
  const [sample_code, setCode] = useState("");
  const [event_type, setType] = useState<CustodyEvent>("collected");
  const [location, setLoc] = useState("");
  const [carrier, setCarrier] = useState("");
  const [waybill, setWb] = useState("");
  const [seal_number, setSeal] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary border border-border rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-mono text-sm font-semibold inline-flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-gold" /> Evento de custodia
          </div>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!sample_code.trim()) {
              toast.error("Código de muestra requerido");
              return;
            }
            onSaved({
              sample_code: sample_code.trim().toUpperCase(),
              event_type,
              location: location || null,
              carrier: carrier || null,
              waybill: waybill || null,
              seal_number: seal_number || null,
              notes: notes || null,
            });
          }}
          className="p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código muestra" required>
              <input
                className="input"
                value={sample_code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="MTRA-001"
                required
              />
            </Field>
            <Field label="Tipo de evento">
              <select
                className="input"
                value={event_type}
                onChange={(e) => setType(e.target.value as CustodyEvent)}
              >
                {(Object.keys(CUSTODY_EVENT_META) as CustodyEvent[]).map((t) => (
                  <option key={t} value={t}>
                    {CUSTODY_EVENT_META[t].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Ubicación">
            <input
              className="input"
              value={location}
              onChange={(e) => setLoc(e.target.value)}
              placeholder="Bodega Calama / Lab ALS Lima"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Carrier">
              <input
                className="input"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="DHL"
              />
            </Field>
            <Field label="Waybill">
              <input
                className="input"
                value={waybill}
                onChange={(e) => setWb(e.target.value)}
                placeholder="WB-12345"
              />
            </Field>
            <Field label="N° sello">
              <input
                className="input"
                value={seal_number}
                onChange={(e) => setSeal(e.target.value)}
                placeholder="SEAL-987"
              />
            </Field>
          </div>
          <Field label="Notas">
            <textarea
              className="input min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-mono rounded border border-border hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-mono rounded bg-gold text-background hover:bg-gold/90"
            >
              Registrar
            </button>
          </div>
        </form>
      </div>
      <DialogStyles />
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DialogStyles() {
  return (
    <style>{`.input { width: 100%; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: 4px; padding: 6px 8px; font-family: ui-monospace, monospace; font-size: 12px; }`}</style>
  );
}
