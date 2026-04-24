// M2 — Visor 3D del modelo de bloques estimado.
// Renderiza bloques como InstancedMesh coloreado por ley (g/t o %).
// Three.js puro, mismo patrón que Geology3DViewer para mantener bundle ligero.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useResourceModels, type ResourceBlock, type ResourceModel } from "@/hooks/useResourceModels";
import { Loader2, Box, Eye, EyeOff, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type Props = {
  model: ResourceModel;
  className?: string;
};

// Colormap "viridis-like" para leyes — robusto, daltónico-friendly
function gradeColor(t: number): THREE.Color {
  // t ∈ [0,1]
  const x = Math.max(0, Math.min(1, t));
  // 5 stops: morado oscuro → azul → verde → amarillo → naranja
  const stops: Array<[number, [number, number, number]]> = [
    [0.0, [0.27, 0.0, 0.33]],
    [0.25, [0.23, 0.32, 0.55]],
    [0.5, [0.13, 0.57, 0.55]],
    [0.75, [0.49, 0.83, 0.36]],
    [1.0, [0.99, 0.91, 0.14]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (x >= a && x <= b) {
      const u = (x - a) / (b - a);
      return new THREE.Color(
        ca[0] + (cb[0] - ca[0]) * u,
        ca[1] + (cb[1] - ca[1]) * u,
        ca[2] + (cb[2] - ca[2]) * u,
      );
    }
  }
  return new THREE.Color(0.99, 0.91, 0.14);
}

export function BlockModel3DViewer({ model, className }: Props) {
  const { fetchBlocks } = useResourceModels();
  const [blocks, setBlocks] = useState<ResourceBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [cutoff, setCutoff] = useState<number>(model.cutoff_grade ?? 0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBlocks(model.id).then((rows) => {
      if (cancelled) return;
      setBlocks(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [model.id, fetchBlocks]);

  const stats = useMemo(() => {
    const grades = blocks.map((b) => b.grade ?? 0).filter((g) => Number.isFinite(g));
    if (grades.length === 0) return { min: 0, max: 1, count: 0 };
    return { min: Math.min(...grades), max: Math.max(...grades), count: grades.length };
  }, [blocks]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || loading || blocks.length === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0a0f");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(1, 1, 1);
    scene.add(dir);

    // Origen — centroide del modelo
    const xs = blocks.map((b) => b.x);
    const ys = blocks.map((b) => b.y);
    const zs = blocks.map((b) => b.z);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const extent = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
      Math.max(...zs) - Math.min(...zs),
      50,
    );

    // Filtrado por cutoff
    const visible = blocks.filter((b) => {
      if (b.grade == null) return showAll;
      if (cutoff > 0 && b.grade < cutoff) return false;
      return true;
    });

    if (visible.length === 0) {
      const sprite = new THREE.Mesh(
        new THREE.BoxGeometry(10, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x666666, wireframe: true }),
      );
      scene.add(sprite);
    } else {
      const geom = new THREE.BoxGeometry(model.block_size_x, model.block_size_z, model.block_size_y);
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = new THREE.InstancedMesh(geom, mat, visible.length);
      const dummy = new THREE.Object3D();
      const range = Math.max(stats.max - stats.min, 1e-6);

      for (let i = 0; i < visible.length; i++) {
        const b = visible[i];
        // Y-up en three: usamos Z geológico como Y, e invertimos
        dummy.position.set(b.x - cx, b.z - cz, -(b.y - cy));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        const t = b.grade != null ? (b.grade - stats.min) / range : 0;
        const col = gradeColor(t);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
    }

    // Ejes referenciales
    const axes = new THREE.AxesHelper(extent * 0.7);
    scene.add(axes);

    // Grid en plano XZ
    const grid = new THREE.GridHelper(extent * 1.5, 20, 0x333333, 0x222222);
    scene.add(grid);

    // Cámara
    const camDist = extent * 1.4;
    camera.position.set(camDist, camDist * 0.7, camDist);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      if (!container) return;
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
  }, [blocks, loading, showAll, cutoff, model.block_size_x, model.block_size_y, model.block_size_z, stats.min, stats.max]);

  const unit = model.commodity === "au" || model.commodity === "ag" ? "g/t" : "%";

  return (
    <div className={`relative border border-border rounded bg-card flex flex-col ${className ?? ""}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border text-[10px] font-mono">
        <div className="flex items-center gap-2 text-text-dim">
          <Box className="w-3 h-3 text-signal-cyan" />
          <span className="uppercase">{model.name}</span>
          <span>·</span>
          <span>{stats.count} bloques · {model.commodity.toUpperCase()} {unit}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px]"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
            {showAll ? "Solo estimados" : "Mostrar todos"}
          </Button>
        </div>
      </div>

      {model.cutoff_grade != null && stats.count > 0 && (
        <div className="px-3 py-2 border-b border-border flex items-center gap-3 text-[10px] font-mono">
          <Layers className="w-3 h-3 text-text-dim" />
          <span className="text-text-dim whitespace-nowrap">Cutoff dinámico:</span>
          <Slider
            min={0}
            max={Math.max(stats.max, model.cutoff_grade) * 1.2}
            step={(stats.max - stats.min) / 100 || 0.01}
            value={[cutoff]}
            onValueChange={(v) => setCutoff(v[0])}
            className="flex-1"
          />
          <span className="text-foreground tabular-nums w-16 text-right">
            ≥ {cutoff.toFixed(model.commodity === "au" || model.commodity === "ag" ? 2 : 3)} {unit}
          </span>
        </div>
      )}

      <div ref={containerRef} className="flex-1 min-h-[400px]" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs font-mono text-text-dim">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cargando bloques…
        </div>
      )}
      {!loading && blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-text-dim">
          Sin bloques estimados — ejecuta "Estimar" para generar el modelo.
        </div>
      )}

      {/* Leyenda colormap */}
      {stats.count > 0 && (
        <div className="absolute bottom-3 right-3 bg-background/85 border border-border rounded px-2 py-1.5 text-[9px] font-mono">
          <div className="text-text-dim mb-1">Ley ({unit})</div>
          <div className="h-2 w-32 rounded" style={{ background: "linear-gradient(to right, #4500a8, #3b5188, #1f928c, #7dd357, #fce824)" }} />
          <div className="flex justify-between text-text-dim mt-0.5">
            <span>{stats.min.toFixed(2)}</span>
            <span>{stats.max.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
