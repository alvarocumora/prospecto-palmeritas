// Visor 3D del pit shell — bloques in-pit coloreados por ore/waste/valor.
// InstancedMesh con Three.js (mismo patrón que BlockModel3DViewer).
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useServerFn } from "@tanstack/react-start";
import { fetchPitBlocks } from "@/lib/schedule.functions";
import { Loader2, Box } from "lucide-react";
import { Button } from "@/components/ui/button";

type Block = {
  id: string;
  x: number;
  y: number;
  z: number;
  grade: number | null;
  is_ore: boolean;
  margin: number;
  value: number;
};

type ColorMode = "ore_waste" | "value" | "grade";

export function PitShell3DViewer({ scenarioId }: { scenarioId: string }) {
  const fetcher = useServerFn(fetchPitBlocks);
  const containerRef = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [size, setSize] = useState({ x: 10, y: 10, z: 5 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ColorMode>("ore_waste");
  const [hideWaste, setHideWaste] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher({ data: { scenarioId } })
      .then((res) => {
        if (cancelled) return;
        setBlocks(res.blocks);
        setSize({
          x: res.model.block_size_x,
          y: res.model.block_size_y,
          z: res.model.block_size_z,
        });
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Error"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [scenarioId, fetcher]);

  const visible = useMemo(
    () => (hideWaste ? blocks.filter((b) => b.is_ore) : blocks),
    [blocks, hideWaste],
  );

  const stats = useMemo(() => {
    const margins = blocks.map((b) => b.margin);
    const grades = blocks.map((b) => b.grade ?? 0).filter((g) => g > 0);
    return {
      ore: blocks.filter((b) => b.is_ore).length,
      waste: blocks.filter((b) => !b.is_ore).length,
      marginMin: margins.length ? Math.min(...margins) : 0,
      marginMax: margins.length ? Math.max(...margins) : 1,
      gradeMin: grades.length ? Math.min(...grades) : 0,
      gradeMax: grades.length ? Math.max(...grades) : 1,
    };
  }, [blocks]);

  useEffect(() => {
    if (!containerRef.current || !visible.length) return;
    const container = containerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 50000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(1, 1, 1);
    scene.add(dir);

    // Centroide
    let cx = 0,
      cy = 0,
      cz = 0;
    visible.forEach((b) => {
      cx += b.x;
      cy += b.y;
      cz += b.z;
    });
    cx /= visible.length;
    cy /= visible.length;
    cz /= visible.length;

    const geo = new THREE.BoxGeometry(size.x, size.z, size.y);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.InstancedMesh(geo, mat, visible.length);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let maxR = 0;
    for (let i = 0; i < visible.length; i++) {
      const b = visible[i];
      // Eje Y vertical en three (usamos z como height)
      dummy.position.set(b.x - cx, b.z - cz, -(b.y - cy));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      let t = 0;
      if (mode === "ore_waste") {
        color.setHex(b.is_ore ? 0x10b981 : 0x6b7280);
      } else if (mode === "value") {
        const range = stats.marginMax - stats.marginMin || 1;
        t = (b.margin - stats.marginMin) / range;
        color.setRGB(1 - t, t * 0.7, t * 0.3); // rojo→verde
      } else {
        const range = stats.gradeMax - stats.gradeMin || 1;
        t = ((b.grade ?? 0) - stats.gradeMin) / range;
        color.setRGB(0.27 + t * 0.7, t * 0.9, 0.33 + (1 - t) * 0.2); // viridis-like
      }
      mesh.setColorAt(i, color);

      maxR = Math.max(maxR, Math.hypot(b.x - cx, b.y - cy, b.z - cz));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);

    camera.position.set(maxR * 1.5, maxR * 1.2, maxR * 1.5);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [visible, size, mode, stats]);

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-text-dim text-xs font-mono">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando pit shell…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-signal-red text-xs font-mono">{error}</div>
    );
  }

  if (!blocks.length) {
    return (
      <div className="p-4 text-text-dim text-xs font-mono">
        Sin bloques in-pit. Corre Optimización de Pit primero.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
        <Box className="w-3 h-3 text-signal-cyan" />
        <span className="text-text-dim">
          {stats.ore} ore · {stats.waste} waste
        </span>
        <div className="flex items-center gap-1 ml-auto">
          {(["ore_waste", "value", "grade"] as ColorMode[]).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "default" : "outline"}
              className="h-6 px-2 text-[10px]"
              onClick={() => setMode(m)}
            >
              {m === "ore_waste" ? "Ore/Waste" : m === "value" ? "Margen" : "Ley"}
            </Button>
          ))}
          <Button
            size="sm"
            variant={hideWaste ? "default" : "outline"}
            className="h-6 px-2 text-[10px]"
            onClick={() => setHideWaste((v) => !v)}
          >
            Solo ore
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="h-[60vh] w-full border border-border rounded bg-black" />
    </div>
  );
}
