// Sprint 5.4 — Visor 3D de sondajes + intercepts + targets.
// Three.js puro, sin react-three-fiber para mantener el bundle bajo.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useDrillHoles } from "@/hooks/useDrilling";
import { useExplorationTargets } from "@/hooks/useExplorationTargets";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import type { DrillCoreLog } from "@/hooks/useDrilling";
import { computeOrigin, buildSceneHoles, toScene, auColor } from "@/lib/3d/holeGeometry";
import { Loader2, Box, Eye, EyeOff } from "lucide-react";

type Props = { className?: string };

export function Geology3DViewer({ className }: Props) {
  const { active } = useProjects();
  const { data: holes, loading: holesLoading } = useDrillHoles(active?.id ?? null);
  const { targets } = useExplorationTargets(active?.id ?? null);
  const [logs, setLogs] = useState<DrillCoreLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showHoles, setShowHoles] = useState(true);
  const [showIntercepts, setShowIntercepts] = useState(true);
  const [showTargets, setShowTargets] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cargar core logs del proyecto
  useEffect(() => {
    if (!active?.id) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    supabase
      .from("drill_core_logs")
      .select("*")
      .eq("project_id", active.id)
      .then(({ data }) => {
        setLogs((data ?? []) as DrillCoreLog[]);
        setLogsLoading(false);
      });
  }, [active?.id]);

  // Setup escena
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#1a1410");

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 50000);
    camera.position.set(800, 600, 800);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Luz
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(500, 1000, 500);
    scene.add(dir);

    // Grilla de superficie
    const grid = new THREE.GridHelper(2000, 40, 0x4a3a2a, 0x3a2e22);
    scene.add(grid);
    const axes = new THREE.AxesHelper(150);
    scene.add(axes);

    // Construir geometría
    const validHoles = holes.filter((h) => h.easting != null && h.northing != null);
    if (validHoles.length > 0) {
      const origin = computeOrigin(validHoles);
      const sceneHoles = buildSceneHoles(validHoles, logs, origin);

      // Sondajes (cilindros traceables: usamos líneas para perf)
      if (showHoles) {
        const holeGroup = new THREE.Group();
        holeGroup.name = "holes";
        for (const sh of sceneHoles) {
          // Línea de sondaje
          const end: [number, number, number] = [
            sh.collar[0] + sh.direction[0] * sh.totalDepth,
            sh.collar[1] + sh.direction[1] * sh.totalDepth,
            sh.collar[2] + sh.direction[2] * sh.totalDepth,
          ];
          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...sh.collar),
            new THREE.Vector3(...end),
          ]);
          const lineMat = new THREE.LineBasicMaterial({ color: 0xc9a876, linewidth: 2 });
          holeGroup.add(new THREE.Line(lineGeo, lineMat));

          // Collar como esfera
          const collarMesh = new THREE.Mesh(
            new THREE.SphereGeometry(8, 12, 12),
            new THREE.MeshStandardMaterial({ color: 0xfbbf24 }),
          );
          collarMesh.position.set(...sh.collar);
          collarMesh.userData = { kind: "hole", id: sh.hole.hole_id, depth: sh.totalDepth };
          holeGroup.add(collarMesh);
        }
        scene.add(holeGroup);
      }

      // Intercepts (cilindros gruesos por tramo)
      if (showIntercepts) {
        const intGroup = new THREE.Group();
        intGroup.name = "intercepts";
        for (const sh of sceneHoles) {
          for (const inter of sh.intercepts) {
            const start = new THREE.Vector3(...inter.from);
            const end = new THREE.Vector3(...inter.to);
            const length = start.distanceTo(end);
            if (length < 0.01) continue;
            const cylGeo = new THREE.CylinderGeometry(3, 3, length, 8);
            const cylMat = new THREE.MeshStandardMaterial({
              color: new THREE.Color(inter.color),
              emissive: new THREE.Color(inter.color),
              emissiveIntensity: 0.4,
            });
            const cyl = new THREE.Mesh(cylGeo, cylMat);
            const mid = start.clone().add(end).multiplyScalar(0.5);
            cyl.position.copy(mid);
            cyl.lookAt(end);
            cyl.rotateX(Math.PI / 2);
            cyl.userData = {
              kind: "intercept",
              hole: sh.hole.hole_id,
              from: inter.log.depth_from,
              to: inter.log.depth_to,
              au: inter.log.au_gpt,
              cu: inter.log.cu_pct,
              lith: inter.log.lithology,
            };
            intGroup.add(cyl);
          }
        }
        scene.add(intGroup);
      }

      // Targets
      if (showTargets) {
        const tgGroup = new THREE.Group();
        tgGroup.name = "targets";
        for (const t of targets) {
          if (t.lat == null || t.lng == null) continue;
          // Aproximación: convertir lat/lng a UTM-like usando referencia muy simple basada en collares.
          // Mejor: targets con UTM. Como fallback ponemos sobre origen al norte/este aprox.
          // Usamos lat/lng -> metros relativos al promedio del proyecto (Chile central ~ 89km/° lng)
          const lat0 = active?.center_lat ?? -33.9;
          const lng0 = active?.center_lng ?? -71.1;
          const dxM = (t.lng - lng0) * 111_320 * Math.cos((lat0 * Math.PI) / 180);
          const dyM = (t.lat - lat0) * 111_320;
          const elev = t.elevation_m ?? 0;
          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(15, 16, 16),
            new THREE.MeshStandardMaterial({
              color:
                t.priority === "critical"
                  ? 0xdc2626
                  : t.priority === "high"
                    ? 0xf59e0b
                    : t.priority === "medium"
                      ? 0x3b82f6
                      : 0x64748b,
              transparent: true,
              opacity: 0.7,
            }),
          );
          sphere.position.set(dxM, elev, -dyM);
          sphere.userData = {
            kind: "target",
            code: t.code,
            name: t.name,
            priority: t.priority,
            stage: t.stage,
            score: t.score,
          };
          tgGroup.add(sphere);
        }
        scene.add(tgGroup);
      }

      // Centrar cámara en bounds
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      controls.target.copy(center);
      camera.position.set(center.x + maxDim, center.y + maxDim * 0.7, center.z + maxDim);
      camera.lookAt(center);
      controls.update();
    }

    // Raycaster para hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      const hit = hits.find((h) => h.object.userData?.kind);
      if (hit) {
        const u = hit.object.userData;
        if (u.kind === "intercept") {
          setHoverInfo(
            `${u.hole} · ${u.from}-${u.to}m · Au ${u.au ?? "—"} g/t${u.cu ? ` · Cu ${u.cu}%` : ""}${u.lith ? ` · ${u.lith}` : ""}`,
          );
        } else if (u.kind === "hole") {
          setHoverInfo(`Sondaje ${u.id} · ${u.depth}m`);
        } else if (u.kind === "target") {
          setHoverInfo(`Target ${u.code} · ${u.name} · ${u.priority} · score ${u.score ?? "—"}`);
        }
      } else {
        setHoverInfo(null);
      }
    };
    renderer.domElement.addEventListener("mousemove", onMouseMove);

    // Loop
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.dispose();
      controls.dispose();
      scene.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
        const mat = (o as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      });
    };
  }, [
    holes,
    logs,
    targets,
    showHoles,
    showIntercepts,
    showTargets,
    active?.center_lat,
    active?.center_lng,
  ]);

  const loading = holesLoading || logsLoading;

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={containerRef} className="w-full h-full bg-bg-primary" />

      {/* Toolbar */}
      <div className="absolute top-3 left-3 flex flex-col gap-1 bg-bg-secondary/95 border border-gold/30 rounded p-2 text-xs font-mono backdrop-blur">
        <div className="flex items-center gap-1.5 text-gold font-semibold mb-1">
          <Box className="w-3.5 h-3.5" /> 3D · {holes.length}H · {logs.length}log · {targets.length}
          T
        </div>
        <button
          onClick={() => setShowHoles((v) => !v)}
          className="flex items-center gap-1.5 hover:text-gold"
        >
          {showHoles ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Sondajes
        </button>
        <button
          onClick={() => setShowIntercepts((v) => !v)}
          className="flex items-center gap-1.5 hover:text-gold"
        >
          {showIntercepts ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Intercepts
        </button>
        <button
          onClick={() => setShowTargets((v) => !v)}
          className="flex items-center gap-1.5 hover:text-gold"
        >
          {showTargets ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Targets
        </button>
      </div>

      {/* Leyenda Au */}
      <div className="absolute bottom-3 left-3 bg-bg-secondary/95 border border-border rounded p-2 text-[10px] font-mono backdrop-blur">
        <div className="text-muted-foreground mb-1">Au g/t</div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ background: auColor(0.2) }} />
          0.1–0.3
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ background: auColor(0.5) }} />
          0.3–1
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ background: auColor(2) }} />
          1–3
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ background: auColor(5) }} />
          ≥3
        </div>
      </div>

      {hoverInfo && (
        <div className="absolute bottom-3 right-3 bg-bg-secondary/95 border border-gold/40 rounded px-3 py-2 text-xs font-mono text-foreground backdrop-blur max-w-md">
          {hoverInfo}
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/80 backdrop-blur">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      )}

      {!loading && holes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm font-mono">
          Sin sondajes con coordenadas para renderizar.
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { toScene };
