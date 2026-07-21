import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  QrCode,
  Camera,
  Upload,
  FileText,
  ArrowRight,
  X,
  Fingerprint,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PUBLIC_APP_HOST, PUBLIC_APP_URL } from "@/lib/publicUrl";

// Pantalla "Verificar QR": entrada única para validar cualquier documento
// emitido por Geocapitals (NDA, LOI, NCNDA, ficha, adenda, etc). Acepta:
//   1) Escaneo con cámara vía BarcodeDetector (nativo Chrome/Edge/Android).
//   2) Subida de imagen del QR (JPG/PNG) también vía BarcodeDetector.
//   3) Subida del PDF original: extrae la referencia del nombre canónico
//      `geocapitals-<TIPO>-<REF>.pdf` y computa un fingerprint SHA-256 del
//      archivo para que la contraparte pueda cotejar contenido out-of-band.
//   4) Ingreso manual de la referencia (Ref · GC-…).
// Todo redirige al detalle canónico `/verificar/$ref`, que consulta la RPC
// `verify_document` en el backend.

type BarcodeDetectorLike = {
  detect: (
    source: ImageBitmap | HTMLVideoElement | HTMLImageElement | Blob,
  ) => Promise<Array<{ rawValue: string }>>;
};
type BarcodeDetectorCtor = new (o: { formats: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  if (!w.BarcodeDetector) return null;
  try {
    return new w.BarcodeDetector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

const REF_REGEX = /GC-[A-Z0-9-]+/i;

function extractReference(raw: string): string | null {
  const clean = raw.trim();
  // URL directa `https://geocapitals.com/verificar/GC-…`
  try {
    const url = new URL(clean);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("verificar");
    if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  } catch {
    // no era URL
  }
  const m = clean.match(REF_REGEX);
  return m ? m[0].toUpperCase() : clean || null;
}

function extractFromFilename(name: string): string | null {
  const m = name.match(REF_REGEX);
  return m ? m[0].toUpperCase() : null;
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function VerifyEntry() {
  const navigate = useNavigate();
  const [manualRef, setManualRef] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [detectorSupported, setDetectorSupported] = useState<boolean | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; ref: string | null; hash: string } | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRafRef = useRef<number | null>(null);

  useEffect(() => {
    setDetectorSupported(!!getBarcodeDetector());
  }, []);

  const goToRef = (raw: string | null) => {
    const ref = raw ? extractReference(raw) : null;
    if (!ref) {
      setError("No se detectó una referencia GC-… válida.");
      return;
    }
    stopCamera();
    navigate({ to: "/verificar/$ref", params: { ref } });
  };

  const stopCamera = () => {
    if (scanRafRef.current) cancelAnimationFrame(scanRafRef.current);
    scanRafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => stopCamera, []);

  const startCamera = async () => {
    setError(null);
    setStatus(null);
    const detector = getBarcodeDetector();
    if (!detector) {
      setError(
        "Este navegador no soporta lectura de QR con cámara. Sube una foto del QR o pega la referencia.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOn(true);
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            goToRef(codes[0].rawValue);
            return;
          }
        } catch {
          // frame malo, seguir
        }
        scanRafRef.current = requestAnimationFrame(tick);
      };
      scanRafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo acceder a la cámara: ${e.message}`
          : "No se pudo acceder a la cámara.",
      );
      stopCamera();
    }
  };

  const handleImageUpload = async (file: File) => {
    setError(null);
    setStatus("Analizando imagen…");
    const detector = getBarcodeDetector();
    if (!detector) {
      setError("Este navegador no puede decodificar QR desde imagen. Pega la referencia manualmente.");
      setStatus(null);
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close?.();
      if (codes.length === 0) {
        setError("No se detectó ningún QR en la imagen.");
        setStatus(null);
        return;
      }
      goToRef(codes[0].rawValue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar la imagen.");
      setStatus(null);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setError(null);
    setStatus("Calculando huella del PDF…");
    try {
      const hash = await sha256Hex(file);
      const ref = extractFromFilename(file.name);
      setFileInfo({ name: file.name, ref, hash });
      setStatus(null);
      if (!ref) {
        setError(
          "El PDF no incluye referencia GC-… en su nombre. Usa el QR o pega la referencia manualmente.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar el PDF.");
      setStatus(null);
    }
  };

  const handleFile = async (file: File) => {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      await handlePdfUpload(file);
    } else {
      await handleImageUpload(file);
    }
  };

  return (
    <main data-theme="im-light" className="min-h-screen bg-surface">
      <header className="border-b border-hairline bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-content">
            <Logo size={22} />
          </Link>
          <a
            href={PUBLIC_APP_URL}
            className="text-[12px] font-mono text-content-subtle hover:text-content"
          >
            {PUBLIC_APP_HOST}
          </a>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-accent-brand">
            Validación de documento
          </div>
          <h1 className="font-display text-3xl lg:text-4xl mt-2 text-content">
            Verificar QR
          </h1>
          <p className="text-sm text-content-subtle mt-2 max-w-2xl">
            Confirma que el documento que recibiste (NDA, LOI, NCNDA, ficha o adenda) coincide con
            el registro oficial en Geocapitals. Puedes escanear el QR, subir el PDF, o pegar la
            referencia impresa en la cabecera.
          </p>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
            <button className="ml-auto" onClick={() => setError(null)} aria-label="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}
        {status ? (
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-hairline bg-white px-4 py-2 text-sm text-content-subtle">
            <Loader2 className="w-4 h-4 animate-spin" />
            {status}
          </div>
        ) : null}

        <div className="grid md:grid-cols-2 gap-5">
          {/* Opción 1 · Cámara */}
          <div className="rounded-2xl border border-hairline bg-white p-5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider bg-accent-brand-subtle text-accent-brand">
                <Camera className="w-3 h-3" /> Cámara
              </span>
              {detectorSupported === false ? (
                <span className="text-[10px] font-mono text-content-subtle">No disponible</span>
              ) : null}
            </div>
            <div className="font-display text-lg text-content">Escanear QR del documento</div>
            <p className="text-sm text-content-subtle mt-1.5 flex-1">
              Apunta la cámara al QR impreso en la cabecera o pie del PDF. Se detecta y valida en
              tiempo real.
            </p>

            {cameraOn ? (
              <div className="mt-4 relative rounded-lg overflow-hidden border border-hairline bg-black aspect-video">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute top-2 right-2 rounded-full bg-black/60 text-white p-1.5"
                  aria-label="Detener cámara"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute inset-4 border-2 border-white/60 rounded-lg pointer-events-none" />
              </div>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                disabled={detectorSupported === false}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-accent-brand text-white px-4 py-2 text-sm font-medium hover:bg-accent-brand/90 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                Abrir cámara
              </button>
            )}
          </div>

          {/* Opción 2 · Subida de archivo (imagen QR o PDF) */}
          <div className="rounded-2xl border border-hairline bg-white p-5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider bg-accent-brand-subtle text-accent-brand">
                <Upload className="w-3 h-3" /> Archivo
              </span>
            </div>
            <div className="font-display text-lg text-content">Subir PDF o foto del QR</div>
            <p className="text-sm text-content-subtle mt-1.5 flex-1">
              Sube el PDF original o una imagen del QR. Del PDF extraemos la referencia y calculamos
              una huella SHA-256 local (el archivo no se sube a ningún servidor).
            </p>
            <label className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-hairline bg-white px-4 py-2 text-sm font-medium hover:border-accent-brand cursor-pointer">
              <Upload className="w-4 h-4" />
              Elegir archivo
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            {fileInfo ? (
              <div className="mt-4 rounded-lg border border-hairline bg-surface-subtle px-3 py-3 space-y-2">
                <div className="flex items-center gap-2 text-[12px] text-content">
                  <FileText className="w-3.5 h-3.5 text-accent-brand" />
                  <span className="truncate font-mono">{fileInfo.name}</span>
                </div>
                <div className="flex items-start gap-2 text-[11px] font-mono text-content-subtle">
                  <Fingerprint className="w-3.5 h-3.5 mt-0.5 text-accent-brand shrink-0" />
                  <span className="break-all">SHA-256 · {fileInfo.hash}</span>
                </div>
                {fileInfo.ref ? (
                  <button
                    type="button"
                    onClick={() => goToRef(fileInfo.ref)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent-brand text-white px-3 py-2 text-sm font-medium hover:bg-accent-brand/90"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Validar {fileInfo.ref}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Opción 3 · Ingreso manual */}
        <div className="mt-6 rounded-2xl border border-hairline bg-white p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider bg-accent-brand-subtle text-accent-brand">
              <QrCode className="w-3 h-3" /> Manual
            </span>
          </div>
          <div className="font-display text-lg text-content">Pegar referencia GC-…</div>
          <p className="text-sm text-content-subtle mt-1.5">
            Copia la referencia impresa en la cabecera del PDF (ej: GC-NDA-AU-202607-9001) o pega el
            enlace completo del QR.
          </p>
          <form
            className="mt-3 flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              goToRef(manualRef);
            }}
          >
            <input
              type="text"
              value={manualRef}
              onChange={(e) => setManualRef(e.target.value)}
              placeholder="GC-NDA-…-9001 o https://geocapitals.com/verificar/GC-…"
              className="flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-brand/40"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-content text-white px-4 py-2 text-sm font-medium hover:bg-content/90"
            >
              Verificar <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="mt-8 rounded-2xl border border-hairline bg-white p-5 text-sm text-content-subtle">
          <div className="flex items-center gap-2 text-content mb-2">
            <ShieldCheck className="w-4 h-4 text-accent-brand" />
            <span className="font-medium">Qué se valida</span>
          </div>
          <ul className="space-y-1.5 list-disc pl-5">
            <li>Existencia de la referencia en el registro oficial de Geocapitals.</li>
            <li>Estado del documento: borrador, pendiente de firma, firmado, vencido o anulado.</li>
            <li>Plantilla, título, fechas de emisión y actualización, y firmante cuando aplica.</li>
            <li>
              Huella SHA-256 del PDF (opcional): comparable out-of-band con el emisor para
              descartar manipulación del archivo.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export const Route = createFileRoute("/verificar/")({
  component: VerifyEntry,
  head: () => ({
    meta: [
      { title: "Verificar QR de documento · Geocapitals" },
      {
        name: "description",
        content:
          "Valida que tu documento Geocapitals (NDA, LOI, NCNDA, ficha, adenda) coincide con el registro oficial. Escanea el QR, sube el PDF o pega la referencia.",
      },
      { property: "og:title", content: "Verificar QR · Geocapitals" },
      {
        property: "og:description",
        content:
          "Validación electrónica de documentos emitidos por Geocapitals: referencia, plantilla, fecha y estado de firma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
