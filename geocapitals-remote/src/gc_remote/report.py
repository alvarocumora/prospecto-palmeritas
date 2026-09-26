"""Reporte HTML de screening Nivel 0.

Ensambla las salidas del pipeline (coverage.json + sampling_candidates.geojson)
en un informe con la identidad de GeoCapitals y TODOS los disclaimers de honestidad
espectral. Dependencias: solo stdlib + jinja2 (no importa numpy/rasterio), por lo
que corre aunque el paquete pesado no esté instalado y es testeable offline.

Un reporte de Nivel 0 NO es un recurso, NO identifica mineral y NO reemplaza terreno.
"""
from __future__ import annotations

import json
from pathlib import Path

from jinja2 import Environment, select_autoescape

# Marca (mismos tokens que geocapitals-docs, para consistencia visual).
BRAND = {"navy": "#0d2b3e", "blue": "#14506b", "gold": "#b98a2f",
         "text": "#1c2430", "muted": "#48586a", "rule": "#c7d0d8",
         "bg": "#f5f8fa", "ok": "#2e7d46", "warn": "#a8752a", "bad": "#a4262c"}

DISCLAIMER_GLOBAL = (
    "Screening satelital Nivel 0 (Sentinel-2). No constituye recurso, reserva ni "
    "identificación mineral. Las anomalías espectrales son indicios que requieren "
    "verificación de terreno (mapeo + ensaye). No reemplaza estudios de detalle."
)

_TEMPLATE = """<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>GeoCapitals — Nivel 0 · {{ prospecto }}</title>
<style>
:root{--navy:{{b.navy}};--blue:{{b.blue}};--gold:{{b.gold}};--text:{{b.text}};
--muted:{{b.muted}};--rule:{{b.rule}};--bg:{{b.bg}};--ok:{{b.ok}};--warn:{{b.warn}};--bad:{{b.bad}}}
*{box-sizing:border-box}
body{font-family:"DejaVu Sans","Carlito",Arial,sans-serif;color:var(--text);
 background:#fff;max-width:900px;margin:0 auto;padding:24px;font-size:13px;line-height:1.5}
.topbar{display:flex;height:12px;border-radius:2px;overflow:hidden;margin-bottom:16px}
.topbar i{display:block;height:100%}.t1{width:45%;background:var(--navy)}
.t2{width:40%;background:var(--blue)}.t3{width:15%;background:var(--gold)}
.head{display:flex;align-items:center;gap:14px;margin-bottom:6px}
.mark{width:44px;height:44px;border:2px solid var(--navy);border-radius:4px;display:flex;
 align-items:center;justify-content:center;color:var(--navy);font-weight:bold;font-size:18px}
.brand{color:var(--navy);font-size:20px;font-weight:bold}
.sub{color:var(--muted);font-size:12px}
h1{color:var(--navy);font-size:22px;margin:14px 0 2px}
h2{color:var(--blue);font-size:15px;border-bottom:1px solid var(--rule);padding-bottom:4px;margin:22px 0 8px}
.lead{color:var(--muted);margin-bottom:10px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;font-size:12px;margin:8px 0}
.meta .k{color:var(--muted)}
table{width:100%;border-collapse:collapse;margin:6px 0 12px;font-size:12px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule);vertical-align:top}
thead th{background:var(--navy);color:#fff;font-size:11px}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
tbody tr:nth-child(even) td{background:var(--bg)}
.badge{display:inline-block;padding:2px 9px;border-radius:3px;color:#fff;font-weight:bold;font-size:11px}
.badge.ok{background:var(--ok)}.badge.warn{background:var(--warn)}.badge.bad{background:var(--bad)}
.box{border:1px solid var(--rule);border-left:3px solid var(--blue);background:var(--bg);
 padding:10px 12px;border-radius:2px;margin:10px 0}
.box.gold{border-left-color:var(--gold)}.box.bad{border-left-color:var(--bad)}
.box .t{font-weight:bold;color:var(--navy);margin-bottom:3px}
.disc{margin-top:18px;padding-top:8px;border-top:1px solid var(--rule);font-size:10.5px;color:var(--muted)}
.kpi{display:flex;gap:12px;margin:10px 0}
.kpi .c{flex:1;border:1px solid var(--rule);border-top:3px solid var(--gold);border-radius:2px;padding:8px 10px}
.kpi .n{color:var(--navy);font-size:19px;font-weight:bold}.kpi .l{color:var(--muted);font-size:11px}
</style></head><body>
<div class="topbar"><i class="t1"></i><i class="t2"></i><i class="t3"></i></div>
<div class="head">
  <div class="mark">GC</div>
  <div><div class="brand">GeoCapitals</div>
  <div class="sub">Screening satelital Nivel 0 · Sentinel-2</div></div>
</div>

<h1>{{ prospecto }}</h1>
<p class="lead">Informe de observabilidad y candidatos de muestreo a partir de series
Sentinel-2 L2A. Producto de tamizaje remoto; no reemplaza terreno.</p>

<div class="meta">
  <div><span class="k">Centro AOI (lon, lat): </span>{{ aoi_lon }}, {{ aoi_lat }}</div>
  <div><span class="k">CRS de salida: </span>{{ output_crs }}</div>
  <div><span class="k">Escenas candidatas: </span>{{ scenes_candidate }}</div>
  <div><span class="k">Escenas usadas (coverage): </span>{{ scenes_used }}</div>
  <div><span class="k">config_sha256: </span>{{ config_sha }}</div>
</div>

<h2>1 · Observabilidad (cobertura)</h2>
<div class="box {{ 'gold' if conclusive else 'bad' }}">
  <div class="t">
    {% if conclusive %}<span class="badge ok">ESPECTRAL APLICABLE</span>
    {% else %}<span class="badge bad">ESPECTRAL NO CONCLUYENTE</span>{% endif %}
  </div>
  <div>{{ headline }}</div>
</div>
<div class="kpi">
  <div class="c"><div class="n">{{ typical_pct }}%</div><div class="l">Interpretable típica (persistente) — gate</div></div>
  <div class="c"><div class="n">{{ bestcase_pct }}%</div><div class="l">Interpretable mejor caso (fin de verano)</div></div>
  <div class="c"><div class="n">{{ floor_pct }}%</div><div class="l">Piso de decisión</div></div>
</div>
<table>
  <thead><tr><th>Clase (mosaico típico)</th><th class="num">Fracción del área</th></tr></thead>
  <tbody>
  {% for name, frac in classes %}
    <tr><td>{{ name }}</td><td class="num">{{ '%.1f'|format(frac*100) }}%</td></tr>
  {% endfor %}
  </tbody>
</table>
<div class="box">
  <div class="t">Qué significa "interpretable"</div>
  <div>Superficie sin cubierta vegetal y observable (incluye suelo seco). Sentinel-2
  <b>no separa roca de suelo</b>: es exposición, no litología.</div>
</div>

<h2>2 · Candidatos de muestreo</h2>
{% if candidates %}
<p class="lead">Anomalías del índice primario <b>{{ primary_index }}</b> sobre superficie
interpretable, rankeadas por z-score respecto al fondo del AOI.</p>
<table>
  <thead><tr><th class="num">#</th><th class="num">z-score</th><th class="num">percentil</th>
    <th>Este</th><th>Norte</th><th>Lon</th><th>Lat</th></tr></thead>
  <tbody>
  {% for c in candidates %}
    <tr><td class="num">{{ c.rank }}</td><td class="num">{{ c.z }}</td><td class="num">{{ c.pct }}</td>
      <td>{{ c.easting }}</td><td>{{ c.northing }}</td><td>{{ c.lon }}</td><td>{{ c.lat }}</td></tr>
  {% endfor %}
  </tbody>
</table>
<div class="box gold"><div class="t">Leyenda de candidato</div><div>{{ candidate_legend }}</div></div>
{% else %}
<p class="lead">Sin candidatos en esta corrida (o el módulo de candidatos no se ejecutó).</p>
{% endif %}

<h2>3 · Scorecard</h2>
<div class="box {{ 'gold' if conclusive else 'bad' }}">
  <div class="t">Veredicto Nivel 0</div>
  <div>{{ scorecard }}</div>
</div>

<div class="disc">{{ disclaimer }}</div>
</body></html>"""


def _env() -> Environment:
    return Environment(autoescape=select_autoescape(["html", "xml"]),
                       trim_blocks=True, lstrip_blocks=True)


def build_report(coverage_path, candidates_path=None, out_html=None,
                 prospecto: str | None = None) -> Path:
    """Renderiza el reporte HTML a partir de coverage.json y (opcional)
    sampling_candidates.geojson. Devuelve la ruta del HTML escrito."""
    cov = json.loads(Path(coverage_path).read_text(encoding="utf-8"))
    verdict = cov.get("verdict") or {}
    conclusive = bool(verdict.get("spectral_conclusive"))
    typ = cov.get("interpretable_typical_frac", 0.0) or 0.0
    best = cov.get("interpretable_bestcase_frac", 0.0) or 0.0
    floor = verdict.get("floor", 0.15)

    # Desglose por clase del mosaico típico (orden estable, sin nodata a cero).
    frac = ((cov.get("coverage_typical") or {}).get("fraction_of_area")) or {}
    classes = [(k, v) for k, v in frac.items() if v and v > 0]
    classes.sort(key=lambda kv: kv[1], reverse=True)

    candidates, primary_index, candidate_legend = [], "aloh", ""
    if candidates_path and Path(candidates_path).exists():
        fc = json.loads(Path(candidates_path).read_text(encoding="utf-8"))
        meta = fc.get("metadata") or {}
        primary_index = meta.get("primary_index", "aloh")
        candidate_legend = meta.get("disclaimer", "")
        for f in fc.get("features") or []:
            p = f.get("properties") or {}
            g = (f.get("geometry") or {}).get("coordinates") or [None, None]
            zkey = f"{primary_index}_zscore"
            pkey = f"{primary_index}_percentile"
            candidates.append({
                "rank": p.get("rank"),
                "z": p.get(zkey, p.get("aloh_zscore")),
                "pct": p.get(pkey, p.get("aloh_percentile")),
                "easting": p.get("easting"), "northing": p.get("northing"),
                "lon": g[0], "lat": g[1],
            })

    # Scorecard honesto: combina observabilidad + nº de candidatos, sin sobrevender.
    n = len(candidates)
    if conclusive and n:
        scorecard = (f"Observabilidad suficiente para tamizaje espectral. {n} candidato(s) "
                     "de muestreo priorizados; todos requieren verificación de terreno "
                     "(mapeo + ensaye) antes de cualquier decisión.")
    elif conclusive and not n:
        scorecard = ("Observabilidad suficiente, pero no se corrió (o no arrojó) candidatos. "
                     "Ejecutar el módulo de candidatos y validar en terreno.")
    else:
        scorecard = ("Cubierta vegetal por encima del piso: el tamizaje ESPECTRAL no es "
                     "concluyente en esta concesión. El valor está en el análisis "
                     "ESTRUCTURAL del DEM y en el SAR; los candidatos espectrales, si los "
                     "hay, son de baja confianza.")

    html = _env().from_string(_TEMPLATE).render(
        b=BRAND, prospecto=prospecto or cov.get("config") or "Prospecto",
        aoi_lon=_fmt(cov.get("aoi_center_lonlat", [None, None])[0], 5),
        aoi_lat=_fmt(cov.get("aoi_center_lonlat", [None, None])[1], 5),
        output_crs=cov.get("output_crs", "—"),
        scenes_candidate=cov.get("scenes_candidate", "—"),
        scenes_used=cov.get("scenes_used_for_coverage", "—"),
        config_sha=(cov.get("config_sha256") or "")[:16],
        conclusive=conclusive, headline=verdict.get("headline", ""),
        typical_pct=_fmt(typ * 100, 1), bestcase_pct=_fmt(best * 100, 1),
        floor_pct=_fmt(floor * 100, 0), classes=classes,
        candidates=candidates, primary_index=primary_index,
        candidate_legend=candidate_legend, scorecard=scorecard,
        disclaimer=DISCLAIMER_GLOBAL,
    )
    out = Path(out_html) if out_html else Path(coverage_path).with_name("nivel0_report.html")
    out.write_text(html, encoding="utf-8")
    return out


def _fmt(v, dec):
    try:
        return f"{float(v):.{int(dec)}f}"
    except (TypeError, ValueError):
        return "—"
