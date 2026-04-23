// Geochemical Fingerprint: PCA + k-means + pathfinder indices over project samples.
// Pure TypeScript, no native deps. Runs in Deno edge runtime.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ELEMENTS = ["au_gpt", "ag_gpt", "cu_pct", "as_ppm", "sb_ppm", "hg_ppm", "pb_ppm", "zn_ppm", "mo_ppm"] as const;
type Elem = (typeof ELEMENTS)[number];

type SampleRow = {
  id: string;
  sample_code: string;
  sample_type: string;
  au_gpt: number | null;
  ag_gpt: number | null;
  cu_pct: number | null;
  as_ppm: number | null;
  sb_ppm: number | null;
  hg_ppm: number | null;
  pb_ppm: number | null;
  zn_ppm: number | null;
  mo_ppm: number | null;
};

/* ---------- Math utilities ---------- */

function mean(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length;
}
function std(v: number[], m: number): number {
  const s = v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1);
  return Math.sqrt(s) || 1;
}

/** Center-log-ratio-ish: log(x + epsilon) then z-score. Standard for geochem PCA. */
function preprocessMatrix(rows: number[][]): { X: number[][]; means: number[]; sds: number[] } {
  const n = rows.length;
  const p = rows[0].length;
  const log = rows.map((r) => r.map((v) => Math.log10((v ?? 0) + 1e-6)));
  const means: number[] = [];
  const sds: number[] = [];
  for (let j = 0; j < p; j++) {
    const col = log.map((r) => r[j]);
    const m = mean(col);
    const s = std(col, m);
    means.push(m);
    sds.push(s);
  }
  const X = log.map((r) => r.map((v, j) => (v - means[j]) / sds[j]));
  return { X, means, sds };
}

/** Covariance matrix (p x p) of row-major matrix X (n x p, already centered). */
function covariance(X: number[][]): number[][] {
  const n = X.length;
  const p = X[0].length;
  const C: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      for (let b = a; b < p; b++) {
        C[a][b] += X[i][a] * X[i][b];
      }
    }
  }
  for (let a = 0; a < p; a++) {
    for (let b = a; b < p; b++) {
      C[a][b] /= Math.max(1, n - 1);
      C[b][a] = C[a][b];
    }
  }
  return C;
}

/** Jacobi eigen-decomposition for symmetric matrix. Returns sorted eigenvalues + eigenvectors (columns). */
function jacobiEigen(A: number[][]): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const a = A.map((r) => r.slice());
  const v: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  const maxIter = 100;
  for (let iter = 0; iter < maxIter; iter++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off < 1e-12) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-14) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = theta >= 0 ? 1 / (theta + Math.sqrt(1 + theta * theta)) : 1 / (theta - Math.sqrt(1 + theta * theta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;
        const app = a[p][p];
        const aqq = a[q][q];
        const apq = a[p][q];
        a[p][p] = app - t * apq;
        a[q][q] = aqq + t * apq;
        a[p][q] = 0;
        a[q][p] = 0;
        for (let i = 0; i < n; i++) {
          if (i !== p && i !== q) {
            const aip = a[i][p];
            const aiq = a[i][q];
            a[i][p] = c * aip - s * aiq;
            a[p][i] = a[i][p];
            a[i][q] = s * aip + c * aiq;
            a[q][i] = a[i][q];
          }
          const vip = v[i][p];
          const viq = v[i][q];
          v[i][p] = c * vip - s * viq;
          v[i][q] = s * vip + c * viq;
        }
      }
    }
  }
  const values = a.map((r, i) => r[i]);
  const order = values.map((val, i) => ({ val, i })).sort((x, y) => y.val - x.val);
  const sortedValues = order.map((o) => o.val);
  const sortedVectors: number[][] = Array.from({ length: n }, () => new Array(n));
  order.forEach((o, newIdx) => {
    for (let r = 0; r < n; r++) sortedVectors[r][newIdx] = v[r][o.i];
  });
  return { values: sortedValues, vectors: sortedVectors };
}

/** Project rows onto first k components. */
function project(X: number[][], vectors: number[][], k: number): number[][] {
  return X.map((row) => {
    const out = new Array(k).fill(0);
    for (let j = 0; j < k; j++) {
      for (let i = 0; i < row.length; i++) out[j] += row[i] * vectors[i][j];
    }
    return out;
  });
}

/* ---------- K-means ---------- */

function kmeans(points: number[][], k: number, maxIter = 50): { labels: number[]; centroids: number[][] } {
  const n = points.length;
  const dim = points[0].length;
  // k-means++ init
  const centroids: number[][] = [];
  centroids.push(points[Math.floor(Math.random() * n)].slice());
  while (centroids.length < k) {
    const dists = points.map((p) => {
      let m = Infinity;
      for (const c of centroids) {
        let d = 0;
        for (let j = 0; j < dim; j++) d += (p[j] - c[j]) ** 2;
        if (d < m) m = d;
      }
      return m;
    });
    const total = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) { idx = i; break; }
    }
    centroids.push(points[idx].slice());
  }
  const labels = new Array(n).fill(0);
  for (let it = 0; it < maxIter; it++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        let d = 0;
        for (let j = 0; j < dim; j++) d += (points[i][j] - centroids[c][j]) ** 2;
        if (d < bestD) { bestD = d; best = c; }
      }
      if (labels[i] !== best) { labels[i] = best; changed = true; }
    }
    const sums = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      counts[labels[i]]++;
      for (let j = 0; j < dim; j++) sums[labels[i]][j] += points[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) for (let j = 0; j < dim; j++) centroids[c][j] = sums[c][j] / counts[c];
    }
    if (!changed) break;
  }
  return { labels, centroids };
}

/* ---------- Pathfinder + signature classification ---------- */

function pathfinderScores(rows: SampleRow[]): Record<string, number> {
  const realSamples = rows.filter((r) => !["blank", "standard", "duplicate"].includes(r.sample_type));
  const n = Math.max(1, realSamples.length);
  const sum = (k: Elem) => realSamples.reduce((a, r) => a + Math.max(0, (r[k] as number | null) ?? 0), 0) / n;
  return {
    epithermal: Math.log10(1 + sum("as_ppm") + sum("sb_ppm") + sum("hg_ppm") * 10),
    porphyry: Math.log10(1 + sum("cu_pct") * 1000 + sum("mo_ppm") * 5),
    iocg: Math.log10(1 + sum("cu_pct") * 1000 + sum("au_gpt") * 100),
    skarn: Math.log10(1 + sum("zn_ppm") + sum("pb_ppm") + sum("cu_pct") * 1000),
    vms: Math.log10(1 + sum("zn_ppm") + sum("pb_ppm") + sum("cu_pct") * 1000 + sum("ag_gpt") * 50),
  };
}

function classifySignature(scores: Record<string, number>): { signature: string; confidence: number } {
  const entries = Object.entries(scores);
  const total = entries.reduce((a, [, v]) => a + Math.max(0, v), 0) || 1;
  entries.sort((a, b) => b[1] - a[1]);
  const [top, topVal] = entries[0];
  const conf = Math.min(0.99, Math.max(0.3, topVal / total));
  const labels: Record<string, string> = {
    epithermal: "Epitermal Au-Ag (low/intermediate sulfidation)",
    porphyry: "Pórfido Cu-Mo ± Au",
    iocg: "IOCG (Cu-Au óxidos de hierro)",
    skarn: "Skarn polimetálico Zn-Pb-Cu",
    vms: "VMS (sulfuros masivos vulcanogénicos)",
  };
  return { signature: labels[top] ?? top, confidence: conf };
}

/* ---------- Handler ---------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { project_id, k = 4, notes } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userResp, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userResp.user) {
      return new Response(JSON.stringify({ error: "no autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userResp.user.id;

    const { data: samples, error } = await supabase
      .from("sampling_results")
      .select("id,sample_code,sample_type,au_gpt,ag_gpt,cu_pct,as_ppm,sb_ppm,hg_ppm,pb_ppm,zn_ppm,mo_ppm")
      .eq("project_id", project_id)
      .limit(5000);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const rows = (samples ?? []) as SampleRow[];
    const real = rows.filter((r) => !["blank", "standard"].includes(r.sample_type));
    if (real.length < 5) {
      return new Response(JSON.stringify({ error: `Se requieren al menos 5 muestras (encontradas ${real.length})` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Decide which elements have signal (>30% non-null/positive)
    const usable: Elem[] = ELEMENTS.filter((e) => {
      const present = real.filter((r) => (r[e] as number | null) != null && (r[e] as number) > 0).length;
      return present / real.length > 0.3;
    });
    if (usable.length < 2) {
      return new Response(JSON.stringify({ error: "Datos geoquímicos insuficientes (se requieren ≥2 elementos con cobertura)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build matrix
    const matrix = real.map((r) => usable.map((e) => Math.max(0, (r[e] as number | null) ?? 0)));
    const { X } = preprocessMatrix(matrix);

    // PCA via covariance + Jacobi
    const C = covariance(X);
    const { values, vectors } = jacobiEigen(C);
    const totalVar = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const variance = values.map((v) => Math.max(0, v) / totalVar);
    const kComp = Math.min(2, vectors.length);
    const scores = project(X, vectors, kComp);

    const loadings: Record<string, { pc1: number; pc2: number }> = {};
    usable.forEach((e, i) => {
      loadings[e] = { pc1: vectors[i][0] ?? 0, pc2: vectors[i][1] ?? 0 };
    });

    // K-means in PC space
    const kClusters = Math.min(Math.max(2, k), 6);
    const { labels, centroids } = kmeans(scores, kClusters);

    // Pathfinder + signature
    const pf = pathfinderScores(rows);
    const { signature, confidence } = classifySignature(pf);

    const clusterAgg = Array.from({ length: kClusters }, (_, c) => {
      const ids = real.filter((_, i) => labels[i] === c).map((r) => r.id);
      const auMean = real.filter((_, i) => labels[i] === c).reduce((a, r) => a + (r.au_gpt ?? 0), 0) / Math.max(1, ids.length);
      return {
        cluster: c,
        centroid_pc1: centroids[c][0],
        centroid_pc2: centroids[c][1],
        sample_ids: ids,
        sample_count: ids.length,
        au_mean_gpt: auMean,
      };
    });

    const sampleScores = real.map((r, i) => ({
      sample_id: r.id,
      sample_code: r.sample_code,
      pc1: scores[i][0] ?? 0,
      pc2: scores[i][1] ?? 0,
      cluster: labels[i],
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("geochem_analyses")
      .insert({
        project_id,
        created_by: userId,
        sample_count: real.length,
        elements_used: usable,
        pca_loadings: loadings,
        pca_variance: { pc1: variance[0] ?? 0, pc2: variance[1] ?? 0, all: variance },
        pca_scores: sampleScores,
        clusters: clusterAgg,
        cluster_count: kClusters,
        pathfinder_scores: pf,
        signature,
        signature_confidence: confidence,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ analysis: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
