import { useEffect, useRef, useState } from "react";

/** Pad de firma manuscrita (mouse/táctil). Devuelve PNG dataURL o null si está vacío. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = getComputedStyle(c).color || "currentColor";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div>
      <canvas
        ref={ref}
        aria-label="Área de firma manuscrita"
        className="h-36 w-full touch-none rounded-md border border-dashed border-hairline bg-surface text-content cursor-crosshair"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={(e) => {
          if (!drawing.current) return;
          drawing.current = false;
          setEmpty(false);
          onChange(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <div className="mt-1 flex justify-between text-[11px] text-content-subtle">
        <span>{empty ? "Firma con el dedo o el mouse" : "Firma capturada"}</span>
        <button
          type="button"
          className="underline hover:text-content"
          onClick={() => {
            const c = ref.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setEmpty(true);
            onChange(null);
          }}
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}

const KEY = (id: string) => `gc-ticket-signature:${id}`;
export const saveSignatureImage = (id: string, d: string) => {
  try {
    localStorage.setItem(KEY(id), d);
  } catch {
    /* almacenamiento lleno: el PDF sale sin trazo */
  }
};
export const loadSignatureImage = (id: string) => {
  try {
    return localStorage.getItem(KEY(id));
  } catch {
    return null;
  }
};
