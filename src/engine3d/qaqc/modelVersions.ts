// Resource Model Versioning — Sprint 4
// Snapshots inmutables del block model con hash de entrada y settings.

import type { BlockModelParams } from "@/engine3d/hooks/useBlockModel";
import { computeHash } from "@/engine3d/qaqc/auditTrail";

export type ResourceSummary = {
  blocks: number;
  tonnes: number;
  gradeMean: number;
  metalContent: number;
  cutoff: number;
  measured: number;
  indicated: number;
  inferred: number;
};

export type ModelVersion = {
  modelId: string;
  timestamp: number;
  iso: string;
  inputHash: string;
  settingsHash: string;
  settings: BlockModelParams;
  summary: ResourceSummary;
  label?: string;
};

const STORAGE_KEY = "engine3d.models.v1";
const MAX_VERSIONS = 50;

function read(): ModelVersion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ModelVersion[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: ModelVersion[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_VERSIONS)));
  } catch {
    // quota — ignore
  }
}

const listeners = new Set<(v: ModelVersion[]) => void>();

export const modelVersions = {
  push(args: {
    inputHash: string;
    settings: BlockModelParams;
    summary: ResourceSummary;
    label?: string;
  }): ModelVersion {
    const timestamp = Date.now();
    const settingsHash = computeHash(args.settings);
    const modelId = `bm_${timestamp.toString(36)}_${args.inputHash}_${settingsHash}`;
    const v: ModelVersion = {
      modelId,
      timestamp,
      iso: new Date(timestamp).toISOString(),
      inputHash: args.inputHash,
      settingsHash,
      settings: args.settings,
      summary: args.summary,
      label: args.label,
    };
    // Evitar duplicados consecutivos con mismo hash
    const list = read();
    const last = list[list.length - 1];
    if (last && last.inputHash === v.inputHash && last.settingsHash === v.settingsHash) {
      return last;
    }
    const next = [...list, v];
    write(next);
    listeners.forEach((l) => l(next));
    return v;
  },
  list(): ModelVersion[] {
    return read();
  },
  compare(aId: string, bId: string): {
    a: ModelVersion;
    b: ModelVersion;
    delta: ResourceSummary;
  } | null {
    const list = read();
    const a = list.find((v) => v.modelId === aId);
    const b = list.find((v) => v.modelId === bId);
    if (!a || !b) return null;
    const delta: ResourceSummary = {
      blocks: b.summary.blocks - a.summary.blocks,
      tonnes: b.summary.tonnes - a.summary.tonnes,
      gradeMean: b.summary.gradeMean - a.summary.gradeMean,
      metalContent: b.summary.metalContent - a.summary.metalContent,
      cutoff: b.summary.cutoff - a.summary.cutoff,
      measured: b.summary.measured - a.summary.measured,
      indicated: b.summary.indicated - a.summary.indicated,
      inferred: b.summary.inferred - a.summary.inferred,
    };
    return { a, b, delta };
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEY);
    listeners.forEach((l) => l([]));
  },
  subscribe(cb: (v: ModelVersion[]) => void): () => void {
    listeners.add(cb);
    cb(read());
    return () => listeners.delete(cb);
  },
};
