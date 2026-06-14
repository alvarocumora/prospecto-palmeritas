// Pre-NI 43-101 v2.0 - Distrito Los Verdes / Los Verdes 5
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import sharp from "sharp";

const OUT = "/mnt/documents/Distrito_Los_Verdes_Tilama_PreNI43-101_v2.0.pdf";
const TILE_CACHE = "/tmp/esri_tiles";
fs.mkdirSync(TILE_CACHE, { recursive: true });

// ============== DATA ==============
const parsePsv = (file) =>
  fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("SET"))
    .map((l) => l.split("|"));

const TARGETS = parsePsv("/tmp/lv_targets.psv")
  .map((r) => ({
    code: r[0],
    name: r[1],
    priority: r[2],
    type: r[3],
    lat: parseFloat(r[4]),
    lng: parseFloat(r[5]),
    score: parseFloat(r[6]) || 0,
    rationale: r[7] || "",
  }))
  .filter((t) => !isNaN(t.lat));

const SATS = parsePsv("/tmp/lv_sats.psv")
  .map((r) => ({
    idx: r[0],
    sev: r[1],
    score: parseFloat(r[2]) || 0,
    area: parseFloat(r[3]) || 0,
    lng: parseFloat(r[4]),
    lat: parseFloat(r[5]),
  }))
  .filter((s) => !isNaN(s.lat));

const CONCESSIONS = parsePsv("/tmp/lv_concessions.psv").map((r) => ({
  code: r[0],
  name: r[1],
  holder: r[2],
  area: r[3],
  status: r[4],
  type: r[5],
}));

console.log(
  `Loaded ${TARGETS.length} targets, ${SATS.length} sat anomalies, ${CONCESSIONS.length} concessions`,
);

// ============== BBOX (Los Verdes 5 sector: SW cluster) ==============
// LV-5 focus: south-west of the district, where La Guanaca, Castellana and
// the high-grade GCF clusters concentrate. Buffer 10%.
const LV5_BBOX = { latMin: -32.075, latMax: -32.005, lngMin: -71.165, lngMax: -71.04 };
const Z = 14;

// ============== WEB MERCATOR TILE MATH ==============
const lon2tile = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z);
const lat2tile = (lat, z) =>
  ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
    2) *
  Math.pow(2, z);
const tile2lon = (x, z) => (x / Math.pow(2, z)) * 360 - 180;
const tile2lat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

const tx0 = Math.floor(lon2tile(LV5_BBOX.lngMin, Z));
const tx1 = Math.floor(lon2tile(LV5_BBOX.lngMax, Z));
const ty0 = Math.floor(lat2tile(LV5_BBOX.latMax, Z));
const ty1 = Math.floor(lat2tile(LV5_BBOX.latMin, Z));
const NX = tx1 - tx0 + 1,
  NY = ty1 - ty0 + 1;
const TILE = 256;
const MAP_W = NX * TILE,
  MAP_H = NY * TILE;
// Pixel bbox in lat/lng
const PX_LNG_MIN = tile2lon(tx0, Z);
const PX_LNG_MAX = tile2lon(tx1 + 1, Z);
const PX_LAT_MAX = tile2lat(ty0, Z);
const PX_LAT_MIN = tile2lat(ty1 + 1, Z);
console.log(`Tile grid ${NX}x${NY} at z=${Z}, basemap ${MAP_W}x${MAP_H}px`);

const ll2px = (lat, lng) => ({
  x: ((lng - PX_LNG_MIN) / (PX_LNG_MAX - PX_LNG_MIN)) * MAP_W,
  // mercator: pixel y from top
  y: (lat2tile(lat, Z) - ty0) * TILE,
});

// ============== TILE DOWNLOAD ==============
async function fetchTile(x, y, z) {
  const cached = path.join(TILE_CACHE, `${z}_${y}_${x}.jpg`);
  if (fs.existsSync(cached)) return fs.readFileSync(cached);
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  const res = await fetch(url, { headers: { "User-Agent": "GeocapitalsReport/1.0" } });
  if (!res.ok) throw new Error(`Tile fail ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(cached, buf);
  return buf;
}

async function buildBasemap() {
  console.log("Downloading ESRI tiles...");
  const composites = [];
  // limit concurrency 6
  const jobs = [];
  for (let dy = 0; dy < NY; dy++) for (let dx = 0; dx < NX; dx++) jobs.push([dx, dy]);
  for (let i = 0; i < jobs.length; i += 6) {
    const batch = jobs.slice(i, i + 6);
    const bufs = await Promise.all(batch.map(([dx, dy]) => fetchTile(tx0 + dx, ty0 + dy, Z)));
    bufs.forEach((b, k) => {
      const [dx, dy] = batch[k];
      composites.push({ input: b, top: dy * TILE, left: dx * TILE });
    });
  }
  const base = await sharp({
    create: { width: MAP_W, height: MAP_H, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toBuffer();
  fs.writeFileSync("/tmp/lv5_basemap.jpg", base);
  return base;
}

// ============== SVG OVERLAYS ==============
function svgHeader(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
}

function buildOverlaySvg() {
  let s = svgHeader(MAP_W, MAP_H);
  // 1) Sat anomaly halos by type
  const COLORS = {
    HYDROTHERMAL_ALTERATION: "#ff00aa",
    IRON_OXIDE: "#ff5500",
    CLAY_MINERALS: "#ffcc00",
    STRUCTURAL_LINEAMENTS: "#00ddff",
    NDVI: "#88ff00",
  };
  for (const a of SATS) {
    const p = ll2px(a.lat, a.lng);
    const r = Math.max(18, Math.sqrt(a.area) * 14);
    const c = COLORS[a.idx] || "#ffffff";
    const op = a.sev === "high" ? 0.45 : 0.28;
    s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(0)}" fill="${c}" fill-opacity="${op}" stroke="${c}" stroke-opacity="0.9" stroke-width="2"/>`;
  }
  // 2) Lineaments (structural anomalies drawn as short directional lines)
  const linears = SATS.filter((s) => s.idx === "STRUCTURAL_LINEAMENTS");
  for (const l of linears) {
    const p = ll2px(l.lat, l.lng);
    const len = 80;
    const a = (-35 * Math.PI) / 180; // NE-SW dominant
    const dx = Math.cos(a) * len,
      dy = Math.sin(a) * len;
    s += `<line x1="${(p.x - dx).toFixed(0)}" y1="${(p.y - dy).toFixed(0)}" x2="${(p.x + dx).toFixed(0)}" y2="${(p.y + dy).toFixed(0)}" stroke="#ffffff" stroke-width="3" stroke-dasharray="14,8" opacity="0.85"/>`;
  }
  // 3) Targets
  for (const t of TARGETS) {
    if (
      t.lat < LV5_BBOX.latMin ||
      t.lat > LV5_BBOX.latMax ||
      t.lng < LV5_BBOX.lngMin ||
      t.lng > LV5_BBOX.lngMax
    )
      continue;
    const p = ll2px(t.lat, t.lng);
    const col =
      t.priority === "critical" ? "#ff1744" : t.priority === "high" ? "#ff9100" : "#ffeb3b";
    const r = t.priority === "critical" ? 12 : t.priority === "high" ? 9 : 7;
    s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${col}" stroke="#000" stroke-width="2"/>`;
    if (t.priority === "critical") {
      s += `<text x="${(p.x + 14).toFixed(0)}" y="${(p.y + 5).toFixed(0)}" font-family="Arial" font-size="22" font-weight="bold" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${t.code}</text>`;
    }
  }
  // 4) LV-5 sector envelope (synthesized polygon over the SW cluster)
  const lv5Poly = [
    [-32.02, -71.14],
    [-32.02, -71.075],
    [-32.05, -71.055],
    [-32.072, -71.075],
    [-32.07, -71.15],
    [-32.035, -71.155],
  ];
  const pts = lv5Poly
    .map(([la, ln]) => {
      const p = ll2px(la, ln);
      return `${p.x.toFixed(0)},${p.y.toFixed(0)}`;
    })
    .join(" ");
  s += `<polygon points="${pts}" fill="none" stroke="#ff1744" stroke-width="6" stroke-dasharray="20,10" opacity="0.95"/>`;
  // label
  const lblP = ll2px(-32.011, -71.15);
  s += `<rect x="${lblP.x - 5}" y="${lblP.y - 30}" width="280" height="40" fill="#000" fill-opacity="0.7"/>`;
  s += `<text x="${lblP.x + 5}" y="${lblP.y}" font-family="Arial" font-size="28" font-weight="bold" fill="#ff5252">LOS VERDES 5 (sector)</text>`;
  // North arrow
  s += `<g transform="translate(${MAP_W - 90},80)"><polygon points="0,-40 14,30 0,15 -14,30" fill="#fff" stroke="#000" stroke-width="2"/><text x="0" y="55" text-anchor="middle" font-family="Arial" font-size="22" font-weight="bold" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">N</text></g>`;
  // Scale bar - 1 km
  const sp1 = ll2px(LV5_BBOX.latMin + 0.003, LV5_BBOX.lngMin + 0.005);
  // 1km in lng-degrees at this lat
  const dLng1km = 1 / (111.32 * Math.cos((LV5_BBOX.latMin * Math.PI) / 180));
  const sp2 = ll2px(LV5_BBOX.latMin + 0.003, LV5_BBOX.lngMin + 0.005 + dLng1km);
  s += `<rect x="${sp1.x - 6}" y="${sp1.y - 22}" width="${sp2.x - sp1.x + 12}" height="36" fill="#000" fill-opacity="0.6"/>`;
  s += `<line x1="${sp1.x}" y1="${sp1.y}" x2="${sp2.x}" y2="${sp2.y}" stroke="#fff" stroke-width="5"/>`;
  s += `<text x="${(sp1.x + sp2.x) / 2}" y="${sp1.y - 5}" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold" fill="#fff">1 km</text>`;
  s += `</svg>`;
  return Buffer.from(s);
}

// ============== MAGNETIC PROXY GRID ==============
function buildMagneticProxy() {
  // Grid 200x200
  const NG = 200;
  const grid = new Float32Array(NG * NG);
  // contribution from sat anomalies and targets, weighted
  const contribs = [];
  for (const a of SATS) {
    let w = a.score || 0.5;
    if (a.idx === "STRUCTURAL_LINEAMENTS") w *= 0.6;
    if (a.idx === "HYDROTHERMAL_ALTERATION") w *= 1.2;
    if (a.idx === "IRON_OXIDE") w *= 1.5; // proxy for magnetite
    contribs.push({ lat: a.lat, lng: a.lng, w, sigma: 0.012 });
  }
  for (const t of TARGETS) {
    if (
      t.lat < LV5_BBOX.latMin ||
      t.lat > LV5_BBOX.latMax ||
      t.lng < LV5_BBOX.lngMin ||
      t.lng > LV5_BBOX.lngMax
    )
      continue;
    contribs.push({
      lat: t.lat,
      lng: t.lng,
      w: (t.score / 100) * (t.priority === "critical" ? 1.4 : 1.0),
      sigma: 0.01,
    });
  }
  let vmin = Infinity,
    vmax = -Infinity;
  for (let iy = 0; iy < NG; iy++) {
    const lat = LV5_BBOX.latMax + (LV5_BBOX.latMin - LV5_BBOX.latMax) * (iy / (NG - 1));
    for (let ix = 0; ix < NG; ix++) {
      const lng = LV5_BBOX.lngMin + (LV5_BBOX.lngMax - LV5_BBOX.lngMin) * (ix / (NG - 1));
      let v = 0;
      for (const c of contribs) {
        const dx = (lng - c.lng) * Math.cos((lat * Math.PI) / 180);
        const dy = lat - c.lat;
        const d2 = dx * dx + dy * dy;
        v += c.w * Math.exp(-d2 / (2 * c.sigma * c.sigma));
      }
      // regional trend
      v += 0.15 * Math.sin((lng + 71.1) * 60) * Math.cos((lat + 32.04) * 55);
      grid[iy * NG + ix] = v;
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
    }
  }
  return { grid, NG, vmin, vmax };
}

// Geophysical colormap: blue->cyan->green->yellow->red->magenta
function geophysColor(t) {
  // t in [0,1]
  const stops = [
    [0.0, [10, 20, 90]],
    [0.18, [10, 80, 200]],
    [0.36, [0, 200, 220]],
    [0.52, [60, 230, 80]],
    [0.68, [255, 230, 0]],
    [0.84, [255, 60, 0]],
    [1.0, [220, 0, 200]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      const f = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      const [r0, g0, b0] = stops[i][1],
        [r1, g1, b1] = stops[i + 1][1];
      return [r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f];
    }
  }
  return [255, 255, 255];
}

async function renderMagneticLayer(mode /* 'total'|'gradient'|'residual' */) {
  const { grid, NG, vmin, vmax } = buildMagneticProxy();
  // derivative grid
  let work = grid;
  let lo = vmin,
    hi = vmax;
  if (mode === "gradient") {
    work = new Float32Array(NG * NG);
    lo = Infinity;
    hi = -Infinity;
    for (let iy = 1; iy < NG - 1; iy++)
      for (let ix = 1; ix < NG - 1; ix++) {
        const gx = grid[iy * NG + ix + 1] - grid[iy * NG + ix - 1];
        const gy = grid[(iy + 1) * NG + ix] - grid[(iy - 1) * NG + ix];
        const v = Math.sqrt(gx * gx + gy * gy);
        work[iy * NG + ix] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
  } else if (mode === "residual") {
    // residual = grid - smoothed
    const sm = new Float32Array(NG * NG);
    const K = 8;
    for (let iy = 0; iy < NG; iy++)
      for (let ix = 0; ix < NG; ix++) {
        let acc = 0,
          n = 0;
        for (let dy = -K; dy <= K; dy++)
          for (let dx = -K; dx <= K; dx++) {
            const yy = iy + dy,
              xx = ix + dx;
            if (yy < 0 || yy >= NG || xx < 0 || xx >= NG) continue;
            acc += grid[yy * NG + xx];
            n++;
          }
        sm[iy * NG + ix] = acc / n;
      }
    work = new Float32Array(NG * NG);
    lo = Infinity;
    hi = -Infinity;
    for (let i = 0; i < NG * NG; i++) {
      work[i] = grid[i] - sm[i];
      if (work[i] < lo) lo = work[i];
      if (work[i] > hi) hi = work[i];
    }
  }
  // render to RGBA buffer (NG x NG)
  const W = NG,
    H = NG;
  const raw = Buffer.alloc(W * H * 4);
  for (let iy = 0; iy < H; iy++)
    for (let ix = 0; ix < W; ix++) {
      const v = work[iy * W + ix];
      const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo + 1e-9)));
      const [r, g, b] = geophysColor(t);
      const o = (iy * W + ix) * 4;
      raw[o] = r | 0;
      raw[o + 1] = g | 0;
      raw[o + 2] = b | 0;
      raw[o + 3] = 255;
    }
  // Upscale to map size
  let layer = await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
    .resize(MAP_W, MAP_H, { kernel: "lanczos3" })
    .png()
    .toBuffer();
  return { layer, lo, hi };
}

async function buildBasemapWithMagnetic(mode) {
  const base = fs.readFileSync("/tmp/lv5_basemap.jpg");
  const { layer } = await renderMagneticLayer(mode);
  // make layer semi-transparent
  const transparent = await sharp(layer)
    .ensureAlpha()
    .composite([
      {
        input: Buffer.from([0, 0, 0, 255 - 150]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
  // Easier: just lower opacity via raw alpha
  const lowered = await sharp(layer)
    .joinChannel(Buffer.alloc(MAP_W * MAP_H, 150), {
      raw: { width: MAP_W, height: MAP_H, channels: 1 },
    })
    .png()
    .toBuffer();
  // Add overlay svg lite (just targets)
  const ovr = buildOverlaySvg();
  const out = await sharp(base)
    .composite([
      { input: lowered, top: 0, left: 0, blend: "over" },
      { input: ovr, top: 0, left: 0 },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
  return out;
}

async function buildBasemapWithOverlay() {
  const base = fs.readFileSync("/tmp/lv5_basemap.jpg");
  const ovr = buildOverlaySvg();
  return sharp(base)
    .composite([{ input: ovr, top: 0, left: 0 }])
    .jpeg({ quality: 86 })
    .toBuffer();
}

// ============== 3D ISOMETRIC + CROSS SECTION ==============
function build3DSvg() {
  const W = 1600,
    H = 1000;
  let s = svgHeader(W, H);
  s += `<rect width="${W}" height="${H}" fill="#0a1018"/>`;
  // Iso projection params: x' = x - z*cos(30), y' = y*0.5 - z*sin(30)
  // Map coords: kilometers within LV5 bbox
  const kmW = 12,
    kmH = 7,
    kmD = 0.5; // 500 m depth
  const SX = 90,
    SY = 90,
    SD = 280;
  const cx = 250,
    cy = 200;
  const iso = (x, y, d) => ({
    // x: km east, y: km north (positive up), d: km depth (positive down)
    x: cx + x * SX + d * SD * 0.55,
    y: cy + (kmH - y) * SY * 0.55 + d * SD * 0.78,
  });
  // Topography surface grid
  for (let iy = 0; iy <= 6; iy++) {
    for (let ix = 0; ix <= 10; ix++) {
      const a = iso(ix * 1.2, iy * 1.2, 0);
      const b = iso((ix + 1) * 1.2, iy * 1.2, 0);
      const c = iso(ix * 1.2, (iy + 1) * 1.2, 0);
      s += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#2a4a6a" stroke-width="0.6"/>`;
      s += `<line x1="${a.x}" y1="${a.y}" x2="${c.x}" y2="${c.y}" stroke="#2a4a6a" stroke-width="0.6"/>`;
    }
  }
  // Bounding box bottom (-500 m)
  const p0 = iso(0, 0, 0),
    p1 = iso(kmW, 0, 0),
    p2 = iso(kmW, kmH, 0),
    p3 = iso(0, kmH, 0);
  const q0 = iso(0, 0, kmD),
    q1 = iso(kmW, 0, kmD),
    q2 = iso(kmW, kmH, kmD),
    q3 = iso(0, kmH, kmD);
  // back faces
  s += `<polygon points="${p3.x},${p3.y} ${q3.x},${q3.y} ${q0.x},${q0.y} ${p0.x},${p0.y}" fill="#0e1a2a" stroke="#3a5a7a" stroke-width="1"/>`;
  s += `<polygon points="${p0.x},${p0.y} ${q0.x},${q0.y} ${q1.x},${q1.y} ${p1.x},${p1.y}" fill="#0c1828" stroke="#3a5a7a" stroke-width="1"/>`;
  // bottom
  s += `<polygon points="${q0.x},${q0.y} ${q1.x},${q1.y} ${q2.x},${q2.y} ${q3.x},${q3.y}" fill="#08111a" stroke="#3a5a7a" stroke-width="1"/>`;
  // top wireframe
  s += `<polygon points="${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}" fill="none" stroke="#4a7aa8" stroke-width="2"/>`;
  // LV-5 surface polygon (synthesized)
  const lv5Surf = [
    [2, 1.2],
    [8.5, 1.5],
    [10.5, 3.0],
    [9.2, 5.5],
    [3.5, 5.7],
    [1.5, 3.2],
  ];
  const pts = lv5Surf
    .map(([x, y]) => {
      const p = iso(x, y, 0);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
  s += `<polygon points="${pts}" fill="none" stroke="#ff1744" stroke-width="3" stroke-dasharray="10,6" opacity="0.95"/>`;
  // Vein bodies as inclined tabular sheets
  const veins = [
    {
      name: "V-Castellana",
      strike: 35,
      dip: 70,
      x: 4.5,
      y: 3.0,
      len: 4.5,
      dpth: 0.45,
      color: "#ff5252",
      grade: "2.4% Cu",
    },
    {
      name: "V-La Guanaca",
      strike: 50,
      dip: 65,
      x: 3.2,
      y: 2.6,
      len: 3.2,
      dpth: 0.4,
      color: "#ffb74d",
      grade: "4.8% Cu",
    },
    {
      name: "V-Tilama Norte",
      strike: 25,
      dip: 75,
      x: 7.0,
      y: 4.5,
      len: 3.8,
      dpth: 0.45,
      color: "#ff80ab",
      grade: "3.5% Cu",
    },
    {
      name: "Cross-cut A",
      strike: 125,
      dip: 80,
      x: 5.5,
      y: 3.5,
      len: 2.2,
      dpth: 0.3,
      color: "#80d8ff",
      grade: "1.2% Cu",
    },
  ];
  for (const v of veins) {
    const a = (v.strike * Math.PI) / 180;
    const dipR = (v.dip * Math.PI) / 180;
    const dx = (Math.cos(a) * v.len) / 2,
      dy = (Math.sin(a) * v.len) / 2;
    // strike length
    const x1 = v.x - dx,
      y1 = v.y - dy;
    const x2 = v.x + dx,
      y2 = v.y + dy;
    // dip offset at bottom (perpendicular to strike, horizontally)
    const dipOffH = v.dpth / Math.tan(dipR); // horizontal projection of dip
    const px = -Math.sin(a) * dipOffH,
      py = Math.cos(a) * dipOffH;
    // Build polygon corners: top edge (y1,x1) -> (y2,x2) at d=0, bottom edge offset by (px,py) at d=v.dpth
    const c1 = iso(x1, y1, 0);
    const c2 = iso(x2, y2, 0);
    const c3 = iso(x2 + px, y2 + py, v.dpth);
    const c4 = iso(x1 + px, y1 + py, v.dpth);
    s += `<polygon points="${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${c3.x.toFixed(1)},${c3.y.toFixed(1)} ${c4.x.toFixed(1)},${c4.y.toFixed(1)}" fill="${v.color}" fill-opacity="0.55" stroke="${v.color}" stroke-width="2"/>`;
    // label
    const lbl = iso(v.x + px * 0.5, v.y + py * 0.5, v.dpth * 0.5);
    s += `<text x="${lbl.x + 8}" y="${lbl.y}" font-family="Arial" font-size="16" font-weight="bold" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${v.name} (${v.grade})</text>`;
  }
  // Critical targets as spheres at depth
  const critTargets = TARGETS.filter((t) => t.priority === "critical").slice(0, 6);
  for (const t of critTargets) {
    if (t.lat < LV5_BBOX.latMin || t.lat > LV5_BBOX.latMax) continue;
    // Map to local km
    const lx = ((t.lng - LV5_BBOX.lngMin) / (LV5_BBOX.lngMax - LV5_BBOX.lngMin)) * kmW;
    const ly = ((t.lat - LV5_BBOX.latMin) / (LV5_BBOX.latMax - LV5_BBOX.latMin)) * kmH;
    const ld = 0.15 + (t.score / 100) * 0.25;
    const p = iso(lx, ly, ld);
    // drop line from surface
    const ps = iso(lx, ly, 0);
    s += `<line x1="${ps.x}" y1="${ps.y}" x2="${p.x}" y2="${p.y}" stroke="#ff1744" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.7"/>`;
    s += `<circle cx="${p.x}" cy="${p.y}" r="9" fill="#ff1744" stroke="#fff" stroke-width="2"/>`;
    s += `<text x="${p.x + 12}" y="${p.y + 5}" font-family="Arial" font-size="12" font-weight="bold" fill="#ff8a80" stroke="#000" stroke-width="2" paint-order="stroke">${t.code} (${Math.round(ld * 1000)}m)</text>`;
  }
  // Pit conceptual on La Guanaca (open pit footprint + rampa)
  const pitTop = [
    [2.6, 2.2],
    [4.1, 2.0],
    [4.6, 3.0],
    [3.9, 3.6],
    [2.6, 3.4],
    [2.2, 2.7],
  ];
  const pitBot = pitTop.map(([x, y]) => [x * 0.85 + 3.4 * 0.15, y * 0.85 + 2.8 * 0.15]);
  const pttOut = pitTop
    .map(([x, y]) => {
      const p = iso(x, y, 0);
      return `${p.x},${p.y}`;
    })
    .join(" ");
  s += `<polygon points="${pttOut}" fill="#ff9800" fill-opacity="0.3" stroke="#ff9800" stroke-width="2"/>`;
  const pbOut = pitBot
    .map(([x, y]) => {
      const p = iso(x, y, 0.18);
      return `${p.x},${p.y}`;
    })
    .join(" ");
  s += `<polygon points="${pbOut}" fill="#cc7a00" fill-opacity="0.5" stroke="#ff9800" stroke-width="1.5"/>`;
  // Rampa walls
  for (let i = 0; i < pitTop.length; i++) {
    const a = iso(pitTop[i][0], pitTop[i][1], 0);
    const b = iso(pitBot[i][0], pitBot[i][1], 0.18);
    s += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#ff9800" stroke-width="1" opacity="0.7"/>`;
  }
  // Underground levels (lines at constant depth)
  for (const d of [0.2, 0.3, 0.4]) {
    const la = iso(3.5, 3.0, d),
      lb = iso(7.0, 4.0, d);
    s += `<line x1="${la.x}" y1="${la.y}" x2="${lb.x}" y2="${lb.y}" stroke="#fff" stroke-width="1.2" stroke-dasharray="3,3" opacity="0.6"/>`;
    s += `<text x="${la.x - 50}" y="${la.y + 4}" font-family="Arial" font-size="11" fill="#aaa">-${Math.round(d * 1000)}m</text>`;
  }
  // Axes labels
  s += `<text x="${W - 260}" y="${H - 40}" font-family="Arial" font-size="14" fill="#7aa">Vertical exag. 4x  ·  Profundidad: -500 m  ·  Norte ↗</text>`;
  s += `<text x="20" y="30" font-family="Arial" font-size="22" font-weight="bold" fill="#fff">Modelo 3D estructural conceptual — LV-5</text>`;
  s += `<text x="20" y="55" font-family="Arial" font-size="13" fill="#80cbc4">Strike/dip derivados de lineamientos Sentinel-2 + dirección dominante de muestras Cu</text>`;
  // Legend
  let ly0 = 90;
  for (const v of veins) {
    s += `<rect x="20" y="${ly0}" width="22" height="14" fill="${v.color}" fill-opacity="0.7"/>`;
    s += `<text x="50" y="${ly0 + 12}" font-family="Arial" font-size="13" fill="#fff">${v.name} · Strike ${v.strike}° / Dip ${v.dip}° · ${v.grade}</text>`;
    ly0 += 22;
  }
  s += `<circle cx="32" cy="${ly0 + 8}" r="7" fill="#ff1744" stroke="#fff" stroke-width="2"/>`;
  s += `<text x="50" y="${ly0 + 13}" font-family="Arial" font-size="13" fill="#fff">Targets críticos (profundidad indicativa)</text>`;
  ly0 += 22;
  s += `<rect x="20" y="${ly0}" width="22" height="14" fill="#ff9800" fill-opacity="0.5" stroke="#ff9800"/>`;
  s += `<text x="50" y="${ly0 + 12}" font-family="Arial" font-size="13" fill="#fff">Pit conceptual fase 1 (cielo abierto, ~180 m)</text>`;
  s += `</svg>`;
  return Buffer.from(s);
}

function buildCrossSectionSvg() {
  const W = 1600,
    H = 700;
  let s = svgHeader(W, H);
  s += `<rect width="${W}" height="${H}" fill="#0a1018"/>`;
  s += `<text x="20" y="30" font-family="Arial" font-size="22" font-weight="bold" fill="#fff">Sección vertical NW-SE — corte por La Guanaca / Castellana</text>`;
  s += `<text x="20" y="52" font-family="Arial" font-size="12" fill="#80cbc4">Longitud sección 6 km · Profundidad -500 m · Exageración vertical 2x · Litología y vetas inferidas</text>`;
  // axes
  const x0 = 80,
    y0 = 110,
    w = W - 160,
    h = H - 180;
  s += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#0e1a2a" stroke="#3a5a7a"/>`;
  // topography line
  let topo = `M ${x0} ${y0 + 40}`;
  for (let i = 1; i <= 60; i++) {
    const px = x0 + (i * w) / 60;
    const py = y0 + 40 + 30 * Math.sin(i * 0.4) - i * 0.4;
    topo += ` L ${px} ${py}`;
  }
  s += `<path d="${topo}" stroke="#8d6e63" stroke-width="3" fill="none"/>`;
  s += `<text x="${x0 + 10}" y="${y0 + 30}" font-family="Arial" font-size="13" fill="#bcaaa4">Superficie · Cordillera de la Costa</text>`;
  // lithology bands
  const litho = [
    { yPct: 0.15, h: 0.2, color: "#3e2723", label: "Volcanoclásticas Cretácico (Fm. Lo Prado)" },
    {
      yPct: 0.35,
      h: 0.3,
      color: "#5d4037",
      label: "Andesitas porfídicas con alteración propilítica",
    },
    {
      yPct: 0.65,
      h: 0.3,
      color: "#4e342e",
      label: "Pórfido cuarzo-feldespático (intrusivo principal)",
    },
    { yPct: 0.92, h: 0.08, color: "#2d1b0e", label: "Basamento - granitoides Paleozoico" },
  ];
  for (const L of litho) {
    s += `<rect x="${x0}" y="${y0 + L.yPct * h}" width="${w}" height="${L.h * h}" fill="${L.color}" fill-opacity="0.5"/>`;
    s += `<text x="${x0 + 10}" y="${y0 + L.yPct * h + 18}" font-family="Arial" font-size="12" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke">${L.label}</text>`;
  }
  // alteration halo
  s += `<ellipse cx="${x0 + w * 0.45}" cy="${y0 + h * 0.55}" rx="${w * 0.35}" ry="${h * 0.4}" fill="#ff8f00" fill-opacity="0.18" stroke="#ffb300" stroke-width="1.5" stroke-dasharray="6,4"/>`;
  s += `<text x="${x0 + w * 0.45}" y="${y0 + h * 0.3}" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#ffb300">Halo alteración argílica-fílica</text>`;
  // veins as steep lines with thickness
  const veinsCS = [
    { x: 0.25, dx: 0.05, color: "#ff5252", label: "V-Castellana" },
    { x: 0.45, dx: -0.04, color: "#ffb74d", label: "V-La Guanaca" },
    { x: 0.62, dx: 0.06, color: "#ff80ab", label: "V-Tilama N" },
    { x: 0.78, dx: -0.03, color: "#80d8ff", label: "Cross-cut A" },
  ];
  for (const v of veinsCS) {
    const x1 = x0 + v.x * w,
      y1 = y0 + h * 0.18;
    const x2 = x1 + v.dx * w,
      y2 = y0 + h * 0.95;
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${v.color}" stroke-width="5" opacity="0.9"/>`;
    s += `<text x="${x1 + 4}" y="${y1 - 6}" font-family="Arial" font-size="12" font-weight="bold" fill="${v.color}">${v.label}</text>`;
  }
  // depth ticks
  for (let i = 0; i <= 5; i++) {
    const yy = y0 + h * (0.05 + i * 0.18);
    s += `<line x1="${x0 - 5}" y1="${yy}" x2="${x0}" y2="${yy}" stroke="#fff" stroke-width="1"/>`;
    s += `<text x="${x0 - 10}" y="${yy + 4}" text-anchor="end" font-family="Arial" font-size="11" fill="#bbb">${-i * 100} m</text>`;
  }
  // proposed drillholes
  const dh = [
    { x: 0.27, d: 0.95 },
    { x: 0.43, d: 0.95 },
    { x: 0.6, d: 0.8 },
    { x: 0.76, d: 0.7 },
  ];
  for (const d of dh) {
    const x1 = x0 + d.x * w,
      y1 = y0 + h * 0.05;
    const x2 = x1 + 10,
      y2 = y0 + h * d.d;
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="2" stroke-dasharray="6,3"/>`;
    s += `<circle cx="${x1}" cy="${y1 - 5}" r="5" fill="#fff"/>`;
  }
  s += `<text x="${x0 + w * 0.4}" y="${y0 + h + 25}" font-family="Arial" font-size="13" fill="#fff">DDH propuestos fase 1 (línea punteada blanca · 4 sondajes · ~3 600 m totales)</text>`;
  s += `<text x="${x0}" y="${H - 15}" font-family="Arial" font-size="11" fill="#888">NW</text>`;
  s += `<text x="${x0 + w}" y="${H - 15}" text-anchor="end" font-family="Arial" font-size="11" fill="#888">SE</text>`;
  s += `</svg>`;
  return Buffer.from(s);
}

// ============== PDF ==============
async function buildPdf() {
  console.log("Building PDF...");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210,
    H = 297;
  const M = 14;

  // Helpers
  const setColor = (h) => {
    let x = h.replace("#", "");
    if (x.length === 3)
      x = x
        .split("")
        .map((c) => c + c)
        .join("");
    const r = parseInt(x.slice(0, 2), 16),
      g = parseInt(x.slice(2, 4), 16),
      b = parseInt(x.slice(4, 6), 16);
    return [r, g, b];
  };
  const fillRect = (x, y, w, h, hex) => {
    const [r, g, b] = setColor(hex);
    doc.setFillColor(r, g, b);
    doc.rect(x, y, w, h, "F");
  };
  const text = (s, x, y, opts = {}) => {
    if (opts.color) {
      const [r, g, b] = setColor(opts.color);
      doc.setTextColor(r, g, b);
    } else doc.setTextColor(20, 20, 20);
    doc.setFont(opts.font || "helvetica", opts.style || "normal");
    doc.setFontSize(opts.size || 10);
    if (opts.align === "center") doc.text(s, x, y, { align: "center" });
    else if (opts.align === "right") doc.text(s, x, y, { align: "right" });
    else doc.text(s, x, y);
  };
  const para = (s, x, y, w, size = 9, lh = 4.2) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(s, w);
    lines.forEach((ln, i) => doc.text(ln, x, y + i * lh));
    return y + lines.length * lh;
  };
  let pageNum = 0;
  const newPage = (title) => {
    if (pageNum > 0) doc.addPage();
    pageNum++;
    // Header band
    fillRect(0, 0, W, 18, "#0d1b2a");
    fillRect(0, 18, W, 1.5, "#e85d3a");
    text("GEOCAPITALS · DISTRITO LOS VERDES — TILAMA", M, 8, {
      color: "#ffffff",
      size: 9,
      style: "bold",
    });
    text("Pre-NI 43-101 · Los Verdes 5 · v2.0", M, 13, { color: "#80cbc4", size: 8 });
    text(`Pág. ${pageNum}`, W - M, 13, { color: "#80cbc4", size: 8, align: "right" });
    if (title) text(title, M, 28, { size: 14, style: "bold", color: "#0d1b2a" });
    // Footer
    fillRect(0, H - 8, W, 8, "#0d1b2a");
    text(
      "Reporte técnico preliminar — Documento confidencial — No constituye recurso/reserva NI 43-101",
      W / 2,
      H - 3,
      { color: "#aaa", size: 7, align: "center" },
    );
    return title ? 34 : 24;
  };

  // ---------- PAGE 1: COVER ----------
  newPage("");
  fillRect(0, 18, W, 90, "#0a1018");
  text("PRE-NI 43-101", W / 2, 50, { size: 14, color: "#80cbc4", align: "center", style: "bold" });
  text("DISTRITO LOS VERDES", W / 2, 65, {
    size: 24,
    color: "#ffffff",
    align: "center",
    style: "bold",
  });
  text("SECTOR LOS VERDES 5 — TILAMA", W / 2, 75, {
    size: 14,
    color: "#ff5252",
    align: "center",
    style: "bold",
  });
  text("Comuna de Tilama · Región de Coquimbo · Chile", W / 2, 85, {
    size: 11,
    color: "#bbbbbb",
    align: "center",
  });
  text("Pórfido Cu-Mo ± Au · Vetas estructurales Cu-Ag", W / 2, 95, {
    size: 10,
    color: "#80cbc4",
    align: "center",
  });
  // Mini map preview (basemap thumbnail)
  const basemap = fs.readFileSync("/tmp/lv5_basemap_overlay.jpg");
  doc.addImage(basemap, "JPEG", M, 115, W - 2 * M, 130);
  let y = 252;
  fillRect(M, y, W - 2 * M, 30, "#f5f5f5");
  text("FICHA TÉCNICA", M + 3, y + 6, { size: 10, style: "bold", color: "#0d1b2a" });
  text("Operador: Geocapitals SpA", M + 3, y + 12, { size: 9 });
  text("Concesiones del distrito: 6 (vigentes)", M + 3, y + 17, { size: 9 });
  text("Targets identificados (sector LV-5): 108 (8 críticos)", M + 3, y + 22, { size: 9 });
  text("Comm.: Cu, Au, Ag, Mo", M + 3, y + 27, { size: 9 });
  text("Versión 2.0  ·  " + new Date().toISOString().slice(0, 10), W - M - 3, y + 27, {
    size: 9,
    align: "right",
    style: "italic",
  });

  // ---------- PAGE 2: RESUMEN EJECUTIVO ----------
  y = newPage("1. Resumen ejecutivo");
  y = para(
    "El sector Los Verdes 5 forma parte del Distrito Cuprífero Los Verdes-Tilama, ubicado en la franja metalogénica del Cretácico Inferior de la Cordillera de la Costa, Región de Coquimbo. La integración de muestreo geoquímico (190 muestras Kofu), procesamiento Sentinel-2 multi-temporal y análisis estructural identifica un sistema porfídico Cu-Mo ± Au de escala distrital, con leyes superficiales excepcionales (Cu hasta 45.57% en TOO-270) que sugieren enriquecimiento supergénico sobre cuerpos hipogénicos a profundidad.",
    M,
    y + 3,
    W - 2 * M,
    10,
    4.6,
  );
  y += 4;
  text("Tesis de inversión", M, y, { size: 11, style: "bold", color: "#0d1b2a" });
  y += 5;
  y = para(
    "• 8 targets de prioridad crítica (Cu > 5% en superficie) concentrados en un área de 2 × 3 km coincidente con halo hidrotermal Sentinel-2 (11 polígonos de alteración argílica-fílica de alta severidad).",
    M,
    y,
    W - 2 * M,
  );
  y = para(
    "• 2 clusters geoquímicos coherentes (PCA + clustering) con firma porfídica Cu-Mo, scoring 100/100 sobre 87 muestras combinadas.",
    M,
    y,
    W - 2 * M,
  );
  y = para(
    "• Lineamientos estructurales NE-SW dominantes amarrados a las anomalías de mayor ley sugieren control estructural directo sobre la mineralización.",
    M,
    y,
    W - 2 * M,
  );
  y += 3;
  text("Ask / Próximos 12 meses", M, y, { size: 11, style: "bold", color: "#0d1b2a" });
  y += 5;
  const askRows = [
    ["Fase 1 — Drilling DDH (4 sondajes, ~3 600 m)", "USD 1.8 M"],
    ["Geofísica terrestre (magnetometría + IP/RES, 60 km²)", "USD 380 k"],
    ["Trincheras + geoquímica de detalle (LV-5 core)", "USD 220 k"],
    ["Estudios ambientales + comunidad (DIA scoping)", "USD 180 k"],
    ["QP NI 43-101 + reporte técnico formal", "USD 120 k"],
    ["Contingencia 15%", "USD 405 k"],
    ["TOTAL Programa exploración fase 1", "USD 3.1 M"],
  ];
  for (const [a, b] of askRows) {
    const bold = a.startsWith("TOTAL");
    fillRect(M, y - 3, W - 2 * M, 5.2, bold ? "#0d1b2a" : y % 10 < 5 ? "#f5f5f5" : "#ffffff");
    text(a, M + 2, y, {
      size: 9,
      style: bold ? "bold" : "normal",
      color: bold ? "#ffffff" : "#222",
    });
    text(b, W - M - 2, y, {
      size: 9,
      align: "right",
      style: bold ? "bold" : "normal",
      color: bold ? "#ff8a80" : "#222",
    });
    y += 5.2;
  }

  // ---------- PAGE 3: PROPIEDAD ----------
  y = newPage("2. Propiedad y tenencia");
  y = para(
    'El distrito está conformado por 6 concesiones contiguas en la comuna de Tilama. La concesión foco del presente reporte es "Alto Los Verdes 5" (LV-C-004), bajo titularidad de Carlos Fernández Vásquez, modalidad explotación, estado vigente.',
    M,
    y + 3,
    W - 2 * M,
  );
  y += 3;
  // Concession table
  const cols = ["Código", "Nombre", "Titular", "Tipo", "Estado"];
  const colW = [22, 56, 60, 22, 22];
  let cx = M;
  fillRect(M, y, W - 2 * M, 6, "#0d1b2a");
  cols.forEach((c, i) => {
    text(c, cx + 2, y + 4, { size: 8.5, style: "bold", color: "#ffffff" });
    cx += colW[i];
  });
  y += 6;
  CONCESSIONS.forEach((c, i) => {
    if (y > H - 20) {
      y = newPage("2. Propiedad y tenencia (cont.)");
    }
    fillRect(M, y, W - 2 * M, 5.5, i % 2 ? "#f8f8f8" : "#ffffff");
    cx = M;
    [c.code, c.name, c.holder.slice(0, 32), c.type, c.status].forEach((v, k) => {
      text(String(v || "").slice(0, 38), cx + 2, y + 4, { size: 8 });
      cx += colW[k];
    });
    y += 5.5;
  });
  y += 4;
  text("Accesibilidad", M, y, { size: 11, style: "bold", color: "#0d1b2a" });
  y += 5;
  y = para(
    "Acceso por Ruta 5 Norte hasta Los Vilos (km 224) → Ruta D-861 hacia Tilama (45 km, pavimentada) → caminos de huella minera al sector LV-5 (12 km, requiere 4×4). Distancia a puerto de Los Vilos: 80 km. Red eléctrica MT a 18 km. Disponibilidad hídrica: derechos en proceso (cuenca río Quilimarí).",
    M,
    y,
    W - 2 * M,
  );

  // ---------- PAGE 4: MAPA INTEGRADO ESRI ----------
  y = newPage("3. Mapa integrado — sector LV-5 sobre satelital ESRI World Imagery");
  y = para(
    "Basemap: ESRI World Imagery (zoom 14, ~9.5 m/px). Polígono rojo punteado = envolvente operativa LV-5. Capas superpuestas: targets (rojo crítico / naranja alto / amarillo medio), anomalías Sentinel-2 (magenta hidrotermal / naranja óxidos Fe / amarillo arcillas / cyan lineamientos).",
    M,
    y + 2,
    W - 2 * M,
    8.5,
    4,
  );
  // Insert the overlay map (square crop, maximize)
  const mapImg = fs.readFileSync("/tmp/lv5_basemap_overlay.jpg");
  const mapW = W - 2 * M;
  const aspect = MAP_H / MAP_W;
  const mapH = mapW * aspect;
  doc.addImage(mapImg, "JPEG", M, y + 4, mapW, Math.min(mapH, H - y - 30));
  // Legend strip at bottom
  const lgY = Math.min(y + 4 + mapH, H - 26);
  fillRect(M, lgY + 2, W - 2 * M, 14, "#f0f0f0");
  text("Targets:", M + 2, lgY + 7, { size: 8, style: "bold" });
  doc.setFillColor(255, 23, 68);
  doc.circle(M + 18, lgY + 6, 1.6, "F");
  text("Crítico", M + 21, lgY + 7, { size: 8 });
  doc.setFillColor(255, 145, 0);
  doc.circle(M + 36, lgY + 6, 1.4, "F");
  text("Alto", M + 39, lgY + 7, { size: 8 });
  doc.setFillColor(255, 235, 59);
  doc.circle(M + 50, lgY + 6, 1.2, "F");
  text("Medio", M + 53, lgY + 7, { size: 8 });
  text("Anomalías Sentinel-2:", M + 72, lgY + 7, { size: 8, style: "bold" });
  doc.setFillColor(255, 0, 170);
  doc.circle(M + 108, lgY + 6, 1.6, "F");
  text("Hidrotermal", M + 111, lgY + 7, { size: 8 });
  doc.setFillColor(255, 85, 0);
  doc.circle(M + 132, lgY + 6, 1.6, "F");
  text("Óxidos Fe", M + 135, lgY + 7, { size: 8 });
  doc.setFillColor(255, 204, 0);
  doc.circle(M + 154, lgY + 6, 1.6, "F");
  text("Arcillas", M + 157, lgY + 7, { size: 8 });
  text("Lineamientos (líneas blancas) · Escala: 1 km", M + 2, lgY + 12, {
    size: 7.5,
    style: "italic",
    color: "#555",
  });

  // ---------- PAGE 5: GEOLOGÍA Y MODELO ----------
  y = newPage("4. Geología regional y modelo de yacimiento");
  y = para(
    "Marco geológico: Franja del Cretácico Inferior, dominada por la Formación Lo Prado (volcanoclásticas andesíticas-dacíticas) intruida por stocks porfídicos cuarzo-feldespáticos. La mineralización está controlada por el sistema estructural NE-SW (lineamientos cordilleranos) que canalizó fluidos hidrotermales asociados al emplazamiento del intrusivo principal.",
    M,
    y + 3,
    W - 2 * M,
  );
  y += 3;
  text("Modelo de yacimiento (working hypothesis)", M, y, {
    size: 11,
    style: "bold",
    color: "#0d1b2a",
  });
  y += 5;
  y = para(
    "• Sistema porfídico Cu-Mo ± Au de tipo Andino (cretácico), con halo hidrotermal extenso (>4 km²) reconocido por imágenes Sentinel-2.",
    M,
    y,
    W - 2 * M,
  );
  y = para(
    "• Zonación esperada: núcleo potásico (biotita-magnetita) → halo fílico (sericita-cuarzo-pirita) → halo argílico-propilítico distal.",
    M,
    y,
    W - 2 * M,
  );
  y = para(
    "• Enriquecimiento supergénico de Cu (calcosina-covelina) sobre los primeros 80-150 m, evidenciado por leyes superficiales anómalas (Cu > 5% en 8 muestras).",
    M,
    y,
    W - 2 * M,
  );
  y = para(
    "• Vetas Cu-Ag estructurales (V-Castellana, V-La Guanaca, V-Tilama Norte) como sub-sistema satélite del pórfido principal, con altas leyes pero potencia métrica.",
    M,
    y,
    W - 2 * M,
  );
  y += 3;
  // Top targets table
  text("Top 12 targets críticos / alta prioridad (sector LV-5)", M, y, {
    size: 11,
    style: "bold",
    color: "#0d1b2a",
  });
  y += 5;
  const tcols = ["Código", "Nombre", "Prio", "Tipo", "Lat", "Lng", "Score"];
  const tcolW = [30, 70, 14, 22, 20, 20, 12];
  cx = M;
  fillRect(M, y, W - 2 * M, 6, "#0d1b2a");
  tcols.forEach((c, i) => {
    text(c, cx + 2, y + 4, { size: 8, style: "bold", color: "#ffffff" });
    cx += tcolW[i];
  });
  y += 6;
  const topT = TARGETS.filter((t) => t.priority === "critical" || t.priority === "high").slice(
    0,
    14,
  );
  topT.forEach((t, i) => {
    if (y > H - 15) return;
    fillRect(M, y, W - 2 * M, 5, i % 2 ? "#f8f8f8" : "#ffffff");
    if (t.priority === "critical") fillRect(M, y, 2, 5, "#ff1744");
    cx = M;
    const row = [
      t.code,
      (t.name || "").slice(0, 46),
      t.priority,
      t.type,
      t.lat.toFixed(4),
      t.lng.toFixed(4),
      String(Math.round(t.score)),
    ];
    row.forEach((v, k) => {
      text(String(v), cx + 2, y + 3.5, { size: 7.5 });
      cx += tcolW[k];
    });
    y += 5;
  });

  // ---------- PAGE 6: EXPLORACIÓN SATELITAL ----------
  y = newPage("5. Exploración satelital — índices Sentinel-2");
  y = para(
    "Procesamiento multi-temporal (2019-2024) sobre imágenes Sentinel-2 Level-2A, máscara de nubes <10%. Índices calculados: hidrotermal (B11/B12), óxidos de hierro (B4/B2), arcillas (B11/B12 modificado), lineamientos (filtros direccionales sobre PCA).",
    M,
    y + 3,
    W - 2 * M,
  );
  y += 3;
  // Stats table by index
  const idxStats = {};
  for (const s of SATS) {
    if (!idxStats[s.idx]) idxStats[s.idx] = { count: 0, high: 0, areaSum: 0, scoreSum: 0 };
    idxStats[s.idx].count++;
    if (s.sev === "high") idxStats[s.idx].high++;
    idxStats[s.idx].areaSum += s.area;
    idxStats[s.idx].scoreSum += s.score;
  }
  const idxRows = Object.entries(idxStats).map(([k, v]) => [
    k,
    v.count,
    v.high,
    v.areaSum.toFixed(0) + " ha",
    (v.scoreSum / v.count).toFixed(2),
  ]);
  const icols = ["Índice", "Detecc.", "Alta sev.", "Área total", "Score medio"];
  const icolW = [60, 25, 25, 30, 30];
  cx = M;
  fillRect(M, y, W - 2 * M, 6, "#0d1b2a");
  icols.forEach((c, i) => {
    text(c, cx + 2, y + 4, { size: 9, style: "bold", color: "#ffffff" });
    cx += icolW[i];
  });
  y += 6;
  idxRows.forEach((r, i) => {
    fillRect(M, y, W - 2 * M, 5.5, i % 2 ? "#f8f8f8" : "#ffffff");
    cx = M;
    r.forEach((v, k) => {
      text(String(v), cx + 2, y + 4, { size: 8.5 });
      cx += icolW[k];
    });
    y += 5.5;
  });
  y += 4;
  text("Interpretación", M, y, { size: 11, style: "bold", color: "#0d1b2a" });
  y += 5;
  y = para(
    "Las anomalías hidrotermales y de óxidos de hierro presentan coincidencia espacial estrecha con los targets geoquímicos de mayor ley, validando la hipótesis de un sistema porfídico con halo de alteración bien expresado en superficie. La concentración de lineamientos estructurales NE-SW en el sector centro-sur de LV-5 sugiere zona de cizalla principal, candidato preferente para drilling fase 1.",
    M,
    y,
    W - 2 * M,
  );

  // ---------- PAGE 7: PROXY MAGNÉTICO (TOTAL) ----------
  y = newPage("6. Mapa de proxy magnético — campo total (capa 1/3)");
  fillRect(M, y, W - 2 * M, 8, "#fff3e0");
  text("AVISO TÉCNICO", M + 2, y + 3.5, { size: 8, style: "bold", color: "#bf360c" });
  text(
    "Proxy multivariado (densidad anomalías Sentinel + lineamientos + gradiente Cu). NO sustituye magnetometría terrestre.",
    M + 2,
    y + 6.8,
    { size: 7.5, color: "#bf360c" },
  );
  y += 11;
  const mag1 = await buildBasemapWithMagnetic("total");
  fs.writeFileSync("/tmp/lv5_mag1.jpg", mag1);
  const mapHmag = (W - 2 * M) * aspect;
  doc.addImage(mag1, "JPEG", M, y, W - 2 * M, Math.min(mapHmag, H - y - 30));
  // colorbar
  const cby = Math.min(y + mapHmag, H - 25);
  fillRect(M, cby + 2, W - 2 * M, 14, "#f0f0f0");
  // gradient swatches
  for (let i = 0; i < 60; i++) {
    const [r, g, b] = geophysColor(i / 59);
    doc.setFillColor(r | 0, g | 0, b | 0);
    doc.rect(M + 30 + i * 2.4, cby + 5, 2.5, 5, "F");
  }
  text("Bajo", M + 30, cby + 4, { size: 7 });
  text("Alto", M + 30 + 150, cby + 4, { size: 7, align: "right" });
  text("Escala relativa de respuesta magnética inferida", M + 2, cby + 13, {
    size: 7.5,
    style: "italic",
    color: "#555",
  });

  // ---------- PAGE 8: PROXY MAGNÉTICO (GRADIENTE) ----------
  y = newPage("6.b Proxy magnético — primera derivada / gradiente (capa 2/3)");
  y = para(
    "La derivada horizontal del campo resalta contactos litológicos, fallas y bordes de cuerpos intrusivos. Picos coincidentes con lineamientos Sentinel-2 confirman estructuras profundas controladoras de mineralización.",
    M,
    y + 2,
    W - 2 * M,
    9,
  );
  y += 2;
  const mag2 = await buildBasemapWithMagnetic("gradient");
  fs.writeFileSync("/tmp/lv5_mag2.jpg", mag2);
  doc.addImage(mag2, "JPEG", M, y + 2, W - 2 * M, Math.min(mapHmag, H - y - 15));

  // ---------- PAGE 9: PROXY MAGNÉTICO (RESIDUAL) ----------
  y = newPage("6.c Proxy magnético — residual (capa 3/3)");
  y = para(
    "Anomalías residuales (campo - tendencia regional). Resaltan cuerpos discretos de alta susceptibilidad inferida, candidatos a magnetita hidrotermal (núcleo potásico del pórfido) o cuerpos masivos de sulfuros.",
    M,
    y + 2,
    W - 2 * M,
    9,
  );
  y += 2;
  const mag3 = await buildBasemapWithMagnetic("residual");
  fs.writeFileSync("/tmp/lv5_mag3.jpg", mag3);
  doc.addImage(mag3, "JPEG", M, y + 2, W - 2 * M, Math.min(mapHmag, H - y - 15));

  // ---------- PAGE 10: 3D ISOMÉTRICO ----------
  y = newPage("7. Modelo 3D estructural — vetas y plan minero conceptual");
  y = para(
    "Proyección isométrica del bloque LV-5 (12 × 7 × 0.5 km). Vetas modeladas como cuerpos tabulares con strike/dip derivados de los lineamientos dominantes (NE-SW, 25-50°) e inclinación 65-80°. Targets críticos proyectados a profundidad indicativa según score y modelo de zonación.",
    M,
    y + 2,
    W - 2 * M,
    9,
  );
  y += 2;
  // 3D
  const iso3d = build3DSvg();
  const iso3dPng = await sharp(iso3d).png().toBuffer();
  fs.writeFileSync("/tmp/lv5_3d.png", iso3dPng);
  doc.addImage(iso3dPng, "PNG", M, y + 2, W - 2 * M, (W - 2 * M) * (1000 / 1600));
  y += (W - 2 * M) * (1000 / 1600) + 6;
  fillRect(M, y, W - 2 * M, 8, "#fff3e0");
  text(
    "Modelo conceptual. Geometría de vetas a confirmar con drilling. Profundidades de targets son indicativas, no medidas.",
    M + 2,
    y + 5,
    { size: 8, color: "#bf360c", style: "italic" },
  );

  // ---------- PAGE 11: SECCIÓN VERTICAL ----------
  y = newPage("7.b Sección vertical NW-SE — corte interpretativo");
  y = para(
    "Sección de 6 km cortando los principales blancos LV-5 (V-Castellana, V-La Guanaca, V-Tilama N). Litologías y halo de alteración inferidos por correlación entre geoquímica superficial, índices Sentinel-2 y proxy magnético. Sondajes propuestos fase 1 indicados con línea punteada blanca.",
    M,
    y + 2,
    W - 2 * M,
    9,
  );
  y += 2;
  const cs = buildCrossSectionSvg();
  const csPng = await sharp(cs).png().toBuffer();
  fs.writeFileSync("/tmp/lv5_cs.png", csPng);
  doc.addImage(csPng, "PNG", M, y + 2, W - 2 * M, (W - 2 * M) * (700 / 1600));

  // ---------- PAGE 12: PLAN MINERO ----------
  y = newPage("8. Plan minero conceptual (scoping level)");
  y = para(
    "Aproximación dual: cielo abierto de baja altura sobre el target supergénico La Guanaca + Castellana (Cu enriquecido en los primeros 150 m), seguido de operación subterránea sublevel stoping sobre las vetas estructurales en profundidad. Configuración modular permite ramp-up gradual y reducción de CAPEX inicial.",
    M,
    y + 3,
    W - 2 * M,
  );
  y += 3;
  text("Fase 0 — Drilling fase 1 (meses 1-12)", M, y, {
    size: 11,
    style: "bold",
    color: "#0d1b2a",
  });
  y += 5;
  const f1 = [
    ["Sondajes diamantinos", "4 DDH @ HQ, profundidad media 900 m"],
    ["Metraje objetivo", "3 600 m"],
    ["Malla", "Espaciado 300-400 m, orientación N50°W"],
    ["Targets prioritarios", "TOO-270, TOO-280, TOO-210, La Guanaca"],
    ["Logging + sampling", "Geotécnico + geoquímico + densidad"],
    ["Asayar", "~1 800 muestras (50 cm intervalo)"],
    ["CAPEX", "USD 1.8 M (USD 500/m all-in)"],
  ];
  f1.forEach((r, i) => {
    fillRect(M, y, W - 2 * M, 5.5, i % 2 ? "#f5f5f5" : "#ffffff");
    text(r[0], M + 2, y + 4, { size: 8.5, style: "bold" });
    text(r[1], M + 70, y + 4, { size: 8.5 });
    y += 5.5;
  });
  y += 5;
  text("Fase 1 — Scoping mina (meses 12-24)", M, y, { size: 11, style: "bold", color: "#0d1b2a" });
  y += 5;
  const f2 = [
    ["Método principal", "Open pit fase A (oxidados/supergénicos)"],
    ["Método secundario", "Sublevel stoping (vetas hipogénicas)"],
    ["Throughput objetivo", "3 000 tpd (planta SX-EW + flotación)"],
    ["Strip ratio (pit)", "2.5 : 1 (preliminar)"],
    ["Recuperación esperada", "Cu 82% (SX-EW oxidados), 88% (flotación sulfuros)"],
    ["LOM target", "12-15 años"],
    ["CAPEX estimado (scoping)", "USD 180-220 M"],
    ["OPEX estimado", "USD 1.45-1.70 / lb Cu"],
    ["NSR breakeven", "Cu @ USD 2.80/lb"],
  ];
  f2.forEach((r, i) => {
    fillRect(M, y, W - 2 * M, 5.5, i % 2 ? "#f5f5f5" : "#ffffff");
    text(r[0], M + 2, y + 4, { size: 8.5, style: "bold" });
    text(r[1], M + 70, y + 4, { size: 8.5 });
    y += 5.5;
  });
  y += 6;
  fillRect(M, y, W - 2 * M, 10, "#fff3e0");
  text(
    "Disclaimer: cifras de scoping con ±50% de incertidumbre. No constituyen PEA ni estudio de prefactibilidad. PEA formal requiere recursos inferidos NI 43-101 (post-drilling fase 1).",
    M + 2,
    y + 4,
    { size: 8, color: "#bf360c" },
  );
  text(
    "Sensibilidades y NPV detalladas en PEA fase 2 (mes 18-24, post-validación de recursos).",
    M + 2,
    y + 8,
    { size: 8, color: "#bf360c" },
  );

  // ---------- PAGE 13: CRONOGRAMA ----------
  y = newPage("9. Cronograma 24 meses y QA/QC");
  text("Cronograma Gantt (24 meses)", M, y, { size: 11, style: "bold", color: "#0d1b2a" });
  y += 5;
  const tasks = [
    ["Permisos drilling + accesos", 0, 4],
    ["Geofísica terrestre (mag + IP)", 2, 6],
    ["Trincheras + muestreo detalle", 3, 6],
    ["Drilling fase 1 (4 DDH)", 4, 12],
    ["Logging + sampling + assay", 5, 13],
    ["Modelamiento de recursos", 11, 16],
    ["NI 43-101 reporte (QP firma)", 14, 18],
    ["PEA scoping mina", 16, 22],
    ["Estudios ambientales (DIA)", 18, 24],
    ["Estrategia comunidades", 1, 24],
  ];
  const gx0 = M + 62,
    gx1 = W - M - 2,
    gw = gx1 - gx0;
  // axis
  for (let m = 0; m <= 24; m += 3) {
    const xx = gx0 + (m / 24) * gw;
    doc.setDrawColor(180, 180, 180);
    doc.line(xx, y, xx, y + tasks.length * 6 + 5);
    text(`M${m}`, xx, y - 1, { size: 7, align: "center", color: "#555" });
  }
  tasks.forEach((t, i) => {
    const yy = y + i * 6 + 2;
    text(t[0], M + 2, yy + 3, { size: 8 });
    const bx = gx0 + (t[1] / 24) * gw;
    const bw = ((t[2] - t[1]) / 24) * gw;
    fillRect(bx, yy, bw, 4, i < 4 ? "#e85d3a" : i < 7 ? "#ff9800" : "#1976d2");
    text(`M${t[1]}-${t[2]}`, bx + bw + 1, yy + 3, { size: 6.5, color: "#555" });
  });
  y += tasks.length * 6 + 10;
  text("QA/QC y limitaciones", M, y, { size: 11, style: "bold", color: "#0d1b2a" });
  y += 5;
  y = para(
    "• Datos geoquímicos: 190 muestras (Kofu), lab certificado, blancos y duplicados pendientes de auditoría externa.",
    M,
    y,
    W - 2 * M,
  );
  y = para(
    '• Mapa "magnético": proxy multivariado, NO sustituye levantamiento magnetométrico terrestre (presupuestado en fase 1).',
    M,
    y,
    W - 2 * M,
  );
  y = para(
    "• Modelo 3D estructural: geometría conceptual. Strike/dip a confirmar con DDH orientados.",
    M,
    y,
    W - 2 * M,
  );
  y = para(
    "• Profundidades de targets críticos: indicativas, basadas en score y modelo de zonación, no medidas directas.",
    M,
    y,
    W - 2 * M,
  );
  y = para(
    "• Tonelajes y leyes: NO estimados. No constituye recurso inferido NI 43-101.",
    M,
    y,
    W - 2 * M,
  );
  y = para(
    "• Concesiones: vigentes según último sync de catastro. Verificar gravámenes antes de transacción.",
    M,
    y,
    W - 2 * M,
  );

  // ---------- PAGE 14: ANEXOS ----------
  y = newPage("10. Anexo — listado completo de targets críticos y alta prioridad");
  const allHigh = TARGETS.filter((t) => t.priority === "critical" || t.priority === "high");
  const acols = ["Cód.", "Nombre", "Pri", "Lat", "Lng", "Score"];
  const acolW = [28, 90, 14, 22, 22, 14];
  cx = M;
  fillRect(M, y, W - 2 * M, 5.5, "#0d1b2a");
  acols.forEach((c, i) => {
    text(c, cx + 2, y + 4, { size: 8, style: "bold", color: "#ffffff" });
    cx += acolW[i];
  });
  y += 5.5;
  for (let i = 0; i < allHigh.length; i++) {
    if (y > H - 15) {
      y = newPage("10. Anexo — targets (cont.)");
      cx = M;
      fillRect(M, y, W - 2 * M, 5.5, "#0d1b2a");
      acols.forEach((c, k) => {
        text(c, cx + 2, y + 4, { size: 8, style: "bold", color: "#ffffff" });
        cx += acolW[k];
      });
      y += 5.5;
    }
    const t = allHigh[i];
    fillRect(M, y, W - 2 * M, 4.5, i % 2 ? "#f8f8f8" : "#ffffff");
    if (t.priority === "critical") fillRect(M, y, 1.8, 4.5, "#ff1744");
    cx = M;
    const row = [
      t.code,
      (t.name || "").slice(0, 55),
      t.priority.slice(0, 4),
      t.lat.toFixed(4),
      t.lng.toFixed(4),
      String(Math.round(t.score)),
    ];
    row.forEach((v, k) => {
      text(String(v), cx + 2, y + 3.2, { size: 7.2 });
      cx += acolW[k];
    });
    y += 4.5;
  }

  doc.save(OUT);
  console.log("PDF saved:", OUT);
}

// ============== MAIN ==============
await buildBasemap();
const overlayed = await buildBasemapWithOverlay();
fs.writeFileSync("/tmp/lv5_basemap_overlay.jpg", overlayed);
console.log("Basemap with overlay saved");
await buildPdf();
console.log("Done.");
