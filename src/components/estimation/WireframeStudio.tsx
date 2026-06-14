// WireframeStudio — genera mallas RBF a partir de compósitos del modelo
// (indicator = grade ≥ cutoff) y permite persistir el resultado.
// Renderiza la malla en 3D con three.js (mismo patrón que BlockModel3DViewer).
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { wireframeFromComposites, saveWireframe } from "@/lib/miningEngine.functions";
import { supabase } from "@/integrations/supabase/client";
import { useWireframes } from "@/hooks/useWireframes";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2, Trash2, Save, Boxes } from "lucide-react";
import { toast } from "sonner";
import type { ResourceModel } from "@/hooks/useResourceModels";

type Sample = { x: number; y: number; z: number; indicator: number };
type MeshResult = {
  status: string;
  vertices: number[][];
  faces: number[][];
  volume_m3?: number;
  samples_used?: number;
  bbox?: { min: number[]; max: number[] };
  iso?: number;
  grid_n?: number;
};

export function WireframeStudio({ model }: { model: ResourceModel }) {
  const [cutoff, setCutoff] = useState<number>(
    model.cutoff_grade ?? (model.commodity === "au" || model.commodity === "ag" ? 0.5 : 0.3),
  );
  const [iso, setIso] = useState(0.5);
  const [smooth, setSmooth] = useState(5);
  const [gridN, setGridN] = useState(32);
  const [name, setName] = useState(`${model.name} · RBF`);
  const [mesh, setMesh] = useState<MeshResult | null>(null);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const { data: existing, refresh, remove } = useWireframes(model.project_id);

  const generateFn = useServerFn(wireframeFromComposites);
  const saveFn = useServerFn(saveWireframe);

  // Cargar compósitos georreferenciados (drill_core_logs + collar)
  useEffect(() => {
    let cancelled = false;
    setSamplesLoading(true);
    const valueCol =
      model.commodity === "au" ? "au_gpt" : model.commodity === "ag" ? "ag_gpt" : "cu_pct";
    (async () => {
      const { data, error } = await supabase
        .from("drill_core_logs")
        .select(
          `depth_from,depth_to,${valueCol},drill_holes!inner(easting,northing,elevation,project_id)`,
        )
        .eq("drill_holes.project_id", model.project_id)
        .not(valueCol, "is", null)
        .limit(5000);
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setSamples([]);
      } else {
        const rows = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
          const h = r.drill_holes as {
            easting: number;
            northing: number;
            elevation: number;
          };
          const mid = (Number(r.depth_from) + Number(r.depth_to)) / 2;
          const grade = Number(r[valueCol]);
          return {
            x: Number(h.easting),
            y: Number(h.northing),
            z: Number(h.elevation) - mid,
            grade,
          };
        });
        setSamples(
          rows.map((r) => ({
            x: r.x,
            y: r.y,
            z: r.z,
            indicator: r.grade >= cutoff ? 1 : 0,
          })),
        );
      }
      setSamplesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [model.project_id, model.commodity, cutoff]);

  const oreCount = useMemo(() => samples.filter((s) => s.indicator > 0.5).length, [samples]);

  const generate = useMutation({
    mutationFn: async () => {
      if (samples.length < 4) throw new Error("Necesitas al menos 4 compósitos georreferenciados");
      return generateFn({
        data: { samples, iso, grid_n: gridN, pad: 50, smooth },
      });
    },
    onSuccess: (m) => {
      setMesh(m as MeshResult);
      toast.success(`Malla generada · ${m.vertices?.length ?? 0} vértices`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!mesh) throw new Error("Genera primero la malla");
      return saveFn({
        data: {
          projectId: model.project_id,
          name,
          commodity: model.commodity,
          iso,
          smooth,
          grid_n: gridN,
          pad: 50,
          samples_used: mesh.samples_used ?? samples.length,
          volume_m3: mesh.volume_m3 ?? null,
          vertices: mesh.vertices,
          faces: mesh.faces,
          bbox: mesh.bbox ?? null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Wireframe persistido");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-3">
      <div className="space-y-3 text-[10px] font-mono">
        <div>
          <Label className="text-[10px] uppercase">Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-xs" />
        </div>
        <Field label={`Cutoff (indicador) · ${cutoff.toFixed(3)}`}>
          <Slider
            min={0}
            max={model.commodity === "cu" ? 2 : 5}
            step={0.01}
            value={[cutoff]}
            onValueChange={(v) => setCutoff(v[0])}
          />
        </Field>
        <Field label={`Iso · ${iso.toFixed(2)}`}>
          <Slider
            min={0.1}
            max={0.9}
            step={0.05}
            value={[iso]}
            onValueChange={(v) => setIso(v[0])}
          />
        </Field>
        <Field label={`Suavizado · ${smooth.toFixed(1)}`}>
          <Slider
            min={0}
            max={50}
            step={0.5}
            value={[smooth]}
            onValueChange={(v) => setSmooth(v[0])}
          />
        </Field>
        <Field label={`Grid · ${gridN}³`}>
          <Slider
            min={16}
            max={64}
            step={4}
            value={[gridN]}
            onValueChange={(v) => setGridN(v[0])}
          />
        </Field>

        <div className="text-text-dim space-y-0.5 pt-2 border-t border-border">
          <div>Compósitos: {samples.length}</div>
          <div>
            ≥ cutoff: <b className="text-foreground">{oreCount}</b>
          </div>
          {mesh && (
            <>
              <div>Vértices: {mesh.vertices?.length ?? 0}</div>
              <div>Caras: {mesh.faces?.length ?? 0}</div>
              {mesh.volume_m3 != null && (
                <div>
                  Vol. ≥iso:{" "}
                  <b className="text-foreground">{(mesh.volume_m3 / 1e6).toFixed(2)} Mm³</b>
                </div>
              )}
            </>
          )}
        </div>

        <Button
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => generate.mutate()}
          disabled={generate.isPending || samplesLoading || samples.length < 4}
        >
          {generate.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Wand2 className="w-3 h-3 mr-1" />
          )}
          Generar RBF
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs"
          onClick={() => save.mutate()}
          disabled={!mesh || save.isPending}
        >
          {save.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Save className="w-3 h-3 mr-1" />
          )}
          Guardar
        </Button>

        {existing.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1">
            <div className="text-text-dim uppercase">Guardadas ({existing.length})</div>
            {existing.slice(0, 8).map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-2 text-[9px]">
                <span className="truncate">{w.name}</span>
                <button
                  onClick={() => {
                    if (confirm(`Eliminar "${w.name}"?`)) remove(w.id);
                  }}
                  className="text-signal-red hover:text-signal-red/80"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <MeshViewer mesh={mesh} loading={generate.isPending} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[9px] uppercase text-text-dim">{label}</Label>
      {children}
    </div>
  );
}

function MeshViewer({ mesh, loading }: { mesh: MeshResult | null; loading: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = "";

    const W = container.clientWidth;
    const H = container.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0a0f");
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 50000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(1, 1, 1);
    scene.add(dir);

    let extent = 100;
    if (mesh && mesh.vertices && mesh.vertices.length > 0 && mesh.faces && mesh.faces.length > 0) {
      const verts = mesh.vertices;
      // Centroide
      let cx = 0,
        cy = 0,
        cz = 0;
      for (const v of verts) {
        cx += v[0];
        cy += v[1];
        cz += v[2];
      }
      cx /= verts.length;
      cy /= verts.length;
      cz /= verts.length;

      const positions = new Float32Array(verts.length * 3);
      let minE = Infinity,
        maxE = -Infinity;
      for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        positions[i * 3] = v[0] - cx;
        positions[i * 3 + 1] = v[2] - cz; // Y up
        positions[i * 3 + 2] = -(v[1] - cy);
        const e = Math.max(Math.abs(v[0] - cx), Math.abs(v[1] - cy), Math.abs(v[2] - cz));
        if (e > maxE) maxE = e;
        if (e < minE) minE = e;
      }
      extent = Math.max(maxE, 50);

      const indices = new Uint32Array(mesh.faces.length * 3);
      for (let i = 0; i < mesh.faces.length; i++) {
        const f = mesh.faces[i];
        indices[i * 3] = f[0];
        indices[i * 3 + 1] = f[1];
        indices[i * 3 + 2] = f[2];
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geom.setIndex(new THREE.BufferAttribute(indices, 1));
      geom.computeVertexNormals();

      const mat = new THREE.MeshLambertMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const meshObj = new THREE.Mesh(geom, mat);
      scene.add(meshObj);

      const wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(geom),
        new THREE.LineBasicMaterial({ color: 0xfacc15, opacity: 0.25, transparent: true }),
      );
      scene.add(wire);
    }

    scene.add(new THREE.AxesHelper(extent * 0.6));
    scene.add(new THREE.GridHelper(extent * 1.5, 20, 0x333333, 0x222222));

    const dist = extent * 1.6;
    camera.position.set(dist, dist * 0.7, dist);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [mesh]);

  return (
    <div className="relative border border-border rounded bg-card min-h-[420px]">
      <div ref={ref} className="absolute inset-0" />
      {!mesh && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-text-dim gap-2">
          <Boxes className="w-4 h-4" />
          Configura parámetros y pulsa "Generar RBF"
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-[10px] font-mono text-text-dim">
          <Loader2 className="w-4 h-4 mr-2 animate-spin text-gold" /> Computando RBF en Railway…
        </div>
      )}
    </div>
  );
}
