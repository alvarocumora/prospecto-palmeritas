// Structures3DViewer — Three.js modal showing targets + mag anomalies + structural
// lineaments extruded into a 3D box. Lazy-loaded only when user opens the modal.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Loader2, X, RotateCcw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getLosVerdes3DScene, type Scene3DResponse } from "@/lib/livemap-public.functions";

type Props = { onClose: () => void };

const PRIORITY_COLOR: Record<string, number> = {
  critical: 0xdc2626,
  high: 0xf0c96b,
  medium: 0x3b82f6,
  low: 0x94a3b8,
};

export default function Structures3DViewer({ onClose }: Props) {
  const fetchScene = useServerFn(getLosVerdes3DScene);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [scene, setScene] = useState<Scene3DResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTargets, setShowTargets] = useState(true);
  const [showMag, setShowMag] = useState(true);
  const [showLineaments, setShowLineaments] = useState(true);

  // Fetch scene
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const data = await fetchScene();
        if (!cancel) setScene(data);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Error cargando escena");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [fetchScene]);

  // Build three.js scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !scene) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x0b0a09);
    threeScene.fog = new THREE.Fog(0x0b0a09, 600, 1800);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    camera.position.set(450, 380, 450);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 100;
    controls.maxDistance = 2000;
    controlsRef.current = controls;

    // Lights
    threeScene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(300, 600, 200);
    threeScene.add(dir);

    // Project bbox -> local meters via equirectangular approximation
    const { bbox } = scene;
    const cLat = (bbox.minLat + bbox.maxLat) / 2;
    const cLng = (bbox.minLng + bbox.maxLng) / 2;
    const cosLat = Math.cos((cLat * Math.PI) / 180);
    const M_PER_DEG_LAT = 111_320;
    const M_PER_DEG_LNG = 111_320 * cosLat;
    const widthM = (bbox.maxLng - bbox.minLng) * M_PER_DEG_LNG || 4000;
    const heightM = (bbox.maxLat - bbox.minLat) * M_PER_DEG_LAT || 4000;
    const maxDim = Math.max(widthM, heightM, 2000);
    // Scale: we want the scene roughly ~600 units across
    const scale = 600 / maxDim;

    function toLocal(lat: number, lng: number): [number, number] {
      const dx = (lng - cLng) * M_PER_DEG_LNG * scale;
      const dz = -(lat - cLat) * M_PER_DEG_LAT * scale; // -z = north
      return [dx, dz];
    }

    // Base plane (terrain proxy)
    const planeW = widthM * scale * 1.15;
    const planeH = heightM * scale * 1.15;
    const planeGeo = new THREE.PlaneGeometry(planeW, planeH, 32, 32);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x2d3022,
      roughness: 0.95,
      metalness: 0,
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    threeScene.add(plane);

    // Grid
    const grid = new THREE.GridHelper(Math.max(planeW, planeH), 20, 0x4a5050, 0x2a2d28);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    threeScene.add(grid);

    // Box outline (subsurface volume reference)
    const depthM = 200 * scale * 6; // visual depth, ~1.2km mapped
    const boxOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(planeW, depthM, planeH)),
      new THREE.LineBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.35 }),
    );
    boxOutline.position.y = -depthM / 2;
    threeScene.add(boxOutline);

    // Axes label-free helper
    const axes = new THREE.AxesHelper(60);
    axes.position.set(-planeW / 2 + 30, 2, -planeH / 2 + 30);
    threeScene.add(axes);

    const targetGroup = new THREE.Group();
    const magGroup = new THREE.Group();
    const lineamentGroup = new THREE.Group();
    threeScene.add(targetGroup, magGroup, lineamentGroup);

    // Targets — cylinders, height by score, color by priority
    for (const t of scene.targets) {
      const [x, z] = toLocal(t.lat, t.lng);
      const h = 30 + (t.score / 100) * 90;
      const color = PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium;
      const geo = new THREE.CylinderGeometry(6, 8, h, 16);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, h / 2, z);
      targetGroup.add(mesh);
      // Pin head
      const headGeo = new THREE.SphereGeometry(9, 16, 12);
      const head = new THREE.Mesh(headGeo, mat);
      head.position.set(x, h + 6, z);
      targetGroup.add(head);
    }

    // Mag anomalies — translucent columns going DOWN (geophysics-to-depth)
    for (const m of scene.magAnomalies) {
      const [x, z] = toLocal(m.lat, m.lng);
      const colHeight = 60 + m.intensity * 240;
      const t = Math.min(1, m.intensity);
      // Color ramp blue -> yellow -> red
      const color = new THREE.Color().setHSL(0.7 - 0.7 * t, 0.95, 0.55);
      const geo = new THREE.CylinderGeometry(14, 22, colHeight, 14, 1, true);
      const mat = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        emissive: color,
        emissiveIntensity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, -colHeight / 2 + 2, z);
      magGroup.add(mesh);
    }

    // Lineaments — extruded as vertical planes (structural walls) going down
    for (const l of scene.lineaments) {
      if (l.path.length < 2) continue;
      const wallDepth = 80 + l.score * 220;
      const baseColor = new THREE.Color(0xfacc15);

      for (let i = 0; i < l.path.length - 1; i++) {
        const [aLat, aLng] = l.path[i];
        const [bLat, bLng] = l.path[i + 1];
        const [ax, az] = toLocal(aLat, aLng);
        const [bx, bz] = toLocal(bLat, bLng);
        const segLen = Math.hypot(bx - ax, bz - az);
        if (segLen < 0.5) continue;
        const midX = (ax + bx) / 2;
        const midZ = (az + bz) / 2;
        const angle = Math.atan2(bz - az, bx - ax);

        const geo = new THREE.PlaneGeometry(segLen, wallDepth);
        const mat = new THREE.MeshStandardMaterial({
          color: baseColor,
          emissive: baseColor,
          emissiveIntensity: 0.55,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const wall = new THREE.Mesh(geo, mat);
        wall.position.set(midX, -wallDepth / 2 + 2, midZ);
        // PlaneGeometry sits in XY plane; rotate to vertical (XZ floor plane → vertical wall)
        wall.rotation.x = -Math.PI / 2;
        wall.rotation.y = -angle;
        // Apply dip tilt around segment axis
        const dipRad = ((90 - l.dip_deg) * Math.PI) / 180;
        wall.rotation.z = dipRad;
        lineamentGroup.add(wall);

        // Top glow line
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(ax, 1, az),
          new THREE.Vector3(bx, 1, bz),
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 });
        lineamentGroup.add(new THREE.Line(lineGeo, lineMat));
      }
    }

    targetGroup.visible = showTargets;
    magGroup.visible = showMag;
    lineamentGroup.visible = showLineaments;

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(threeScene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // Expose visibility setters via dataset-like ref
    (mount as unknown as { __setVis?: (k: string, v: boolean) => void }).__setVis = (k, v) => {
      if (k === "targets") targetGroup.visible = v;
      if (k === "mag") magGroup.visible = v;
      if (k === "lineaments") lineamentGroup.visible = v;
    };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      threeScene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose?.());
        else mat?.dispose?.();
      });
    };
  }, [scene, showTargets, showMag, showLineaments]);

  // Toggle visibility without rebuilding scene
  useEffect(() => {
    const mount = mountRef.current as unknown as { __setVis?: (k: string, v: boolean) => void };
    mount?.__setVis?.("targets", showTargets);
  }, [showTargets]);
  useEffect(() => {
    const mount = mountRef.current as unknown as { __setVis?: (k: string, v: boolean) => void };
    mount?.__setVis?.("mag", showMag);
  }, [showMag]);
  useEffect(() => {
    const mount = mountRef.current as unknown as { __setVis?: (k: string, v: boolean) => void };
    mount?.__setVis?.("lineaments", showLineaments);
  }, [showLineaments]);

  const resetView = () => {
    const c = controlsRef.current;
    if (!c) return;
    c.object.position.set(450, 380, 450);
    c.target.set(0, 0, 0);
    c.update();
  };

  return (
    <div className="fixed inset-0 z-[3000] bg-bg-app flex flex-col">
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-bg-panel"
        style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
      >
        <div className="font-mono text-xs text-gold font-bold">Proyección 3D · Los Verdes</div>
        <div className="flex items-center gap-1">
          <button
            onClick={resetView}
            className="min-h-[40px] px-2 rounded-md border border-border bg-bg-app text-foreground font-mono text-[11px] flex items-center gap-1"
            aria-label="Resetear vista"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="min-h-[40px] px-2 rounded-md border border-border bg-bg-app text-foreground font-mono text-[11px]"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={mountRef} className="absolute inset-0" />
        {!scene && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-mono text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando escena 3D…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400 font-mono text-xs">
            {error}
          </div>
        )}

        {/* Layer toggles */}
        <div
          className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2 z-10"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <Chip active={showTargets} onClick={() => setShowTargets((v) => !v)} color="#F0C96B">
            🎯 Targets
          </Chip>
          <Chip active={showMag} onClick={() => setShowMag((v) => !v)} color="#dc2626">
            🧲 Magnetismo
          </Chip>
          <Chip
            active={showLineaments}
            onClick={() => setShowLineaments((v) => !v)}
            color="#facc15"
          >
            ⚡ Estructuras
          </Chip>
        </div>

        {/* Legend */}
        <div className="absolute top-3 left-3 p-2 rounded-md bg-bg-panel/90 backdrop-blur border border-border font-mono text-[10px] text-muted-foreground space-y-1 max-w-[180px]">
          <div className="text-gold font-bold">Leyenda</div>
          <div>• Pines: targets de exploración (alto = score)</div>
          <div>• Columnas: anomalías magnéticas a profundidad</div>
          <div>• Muros amarillos: lineamientos estructurales (dip 70°)</div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="min-h-[40px] px-3 rounded-md border font-mono text-[11px] backdrop-blur"
      style={{
        background: active ? `${color}26` : "rgba(20,18,15,0.85)",
        borderColor: active ? color : "var(--border)",
        color: active ? color : "var(--muted-foreground)",
      }}
    >
      {children}
    </button>
  );
}
