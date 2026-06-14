// Hooks que envuelven los workers QA/QC y compositing.
import { useEffect, useRef, useState } from "react";
import type { QAQCInput, QAQCResult } from "@/engine3d/qaqc/qaqc.worker";
import type { CompositingInput, CompositingResult } from "@/engine3d/qaqc/compositing.worker";

export function useQAQC(input: QAQCInput | null) {
  const [result, setResult] = useState<QAQCResult | null>(null);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("@/engine3d/qaqc/qaqc.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const w = workerRef.current;
    if (!w || !input) {
      setResult(null);
      return;
    }
    const reqId = ++reqRef.current;
    setBusy(true);
    const handler = (e: MessageEvent<{ type: string; result?: QAQCResult }>) => {
      if (reqId !== reqRef.current) return;
      if (e.data?.type === "result" && e.data.result) {
        setResult(e.data.result);
      }
      setBusy(false);
    };
    w.addEventListener("message", handler, { once: true });
    w.postMessage({ type: "validate", input });
    return () => w.removeEventListener("message", handler);
  }, [input]);

  return { result, busy };
}

export function useCompositing(input: CompositingInput | null) {
  const [result, setResult] = useState<CompositingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("@/engine3d/qaqc/compositing.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;
    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const w = workerRef.current;
    if (!w || !input || input.assays.length === 0) {
      setResult(null);
      return;
    }
    const reqId = ++reqRef.current;
    setBusy(true);
    const handler = (e: MessageEvent<{ type: string; result?: CompositingResult }>) => {
      if (reqId !== reqRef.current) return;
      if (e.data?.type === "result" && e.data.result) {
        setResult(e.data.result);
      }
      setBusy(false);
    };
    w.addEventListener("message", handler, { once: true });
    w.postMessage({ type: "composite", input });
    return () => w.removeEventListener("message", handler);
  }, [input]);

  return { result, busy };
}
