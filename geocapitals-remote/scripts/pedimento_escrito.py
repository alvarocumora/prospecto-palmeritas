#!/usr/bin/env python3
"""Generador de ESCRITO LEGAL (borrador) de pedimento / manifestación minera.

Toma un geojson de pedimentos (salida de pedimentos.py, con corners_utm/lados_m/
cara_norte_utm) y produce un borrador de escrito con la estructura del Código de
Minería chileno: individualización del peticionario, tribunal, coordenadas UTM de
los vértices, cara norte, dimensiones y superficie. Render chromium (A4).

Uso: python pedimento_escrito.py <pedimentos.geojson> [indice=0] [tipo=pedimento|manifestacion]

GUARDA INVIOLABLE: es un BORRADOR para revisión de abogado(a) de minería. NO es la
presentación oficial ante el tribunal ni sustituye el patrocinio judicial. Los
datos del peticionario van como campos [POR COMPLETAR] — no se inventan. Requiere
estudio de títulos y, donde aplique, consulta indígena (Convenio 169).
"""
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

TIPO_TXT = {
    "pedimento": ("pedimento de concesión de exploración",
                  "Artículos 112 y siguientes del Código de Minería",
                  "El pedimento se individualiza por el punto medio de su cara norte y sus dimensiones; "
                  "sus lados son orientados norte-sur y este-oeste (ejes UTM). Superficie máxima 5.000 ha."),
    "manifestacion": ("manifestación de concesión de explotación",
                      "Artículos 44 y siguientes del Código de Minería",
                      "La manifestación se individualiza por el punto de interés y las dimensiones de la "
                      "cara; sus lados son orientados norte-sur y este-oeste (ejes UTM)."),
}


def main():
    gj = json.loads(Path(sys.argv[1]).read_text())
    idx = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    tipo = sys.argv[3] if len(sys.argv) > 3 else "pedimento"
    f = gj["features"][idx]
    p = f["properties"]
    corners = p.get("corners_utm", {})
    lados = p.get("lados_m", {})
    cn = p.get("cara_norte_utm", {})
    datum = p.get("datum", "")
    huso = "19 Sur" if "327" in datum and datum.endswith("19") or "32719" in datum else (
        "18 Sur" if "32718" in datum else "por confirmar")
    tit, arts, regla = TIPO_TXT.get(tipo, TIPO_TXT["pedimento"])
    hoy = date.today().strftime("%d de %B de %Y")

    vert_rows = "".join(
        f"<tr><td>{k}</td><td class='n'>{corners[k][0]:,}</td><td class='n'>{corners[k][1]:,}</td></tr>"
        for k in ["NW", "NE", "SE", "SW"] if k in corners
    )

    HTML = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@page {{ size:A4; margin:22mm 24mm; }}
body {{ font-family:'Times New Roman',Georgia,serif; color:#111; font-size:12pt; line-height:1.6; }}
.brand {{ text-align:right; font-family:Helvetica,Arial,sans-serif; font-size:8pt; color:#666; border-bottom:1px solid #999; padding-bottom:4px; margin-bottom:14px; }}
h1 {{ font-size:13pt; text-align:center; text-transform:uppercase; letter-spacing:.5px; margin:0 0 4px; }}
.sub {{ text-align:center; font-size:10pt; color:#444; margin-bottom:18px; }}
.ph {{ background:#fff3cd; padding:0 3px; font-weight:bold; }}
p {{ text-align:justify; margin:8px 0; }}
table {{ width:70%; margin:8px auto; border-collapse:collapse; font-size:10.5pt; }}
th,td {{ border:1px solid #888; padding:3px 8px; }} th {{ background:#eee; }} td.n {{ text-align:right; font-variant-numeric:tabular-nums; }}
.firma {{ margin-top:40px; text-align:center; }}
.guard {{ margin-top:22px; border:1px solid #b8860b; background:#fff8ec; padding:8px 11px; font-family:Helvetica,Arial,sans-serif; font-size:8.5pt; color:#7a5b12; }}
.right {{ text-align:right; }} .center {{ text-align:center; }}
</style></head><body>
<div class="brand">GeoCapitals · Catastro Intelligence — BORRADOR generado el {hoy}</div>

<h1>En lo principal: constituye {tit}</h1>
<div class="sub">Borrador para revisión legal · {arts}</div>

<p class="right">S. J. L. de <span class="ph">[COMUNA / TRIBUNAL COMPETENTE: {p.get('comuna','POR COMPLETAR')}]</span></p>

<p><span class="ph">[NOMBRE DEL PETICIONARIO]</span>, <span class="ph">[NACIONALIDAD]</span>,
<span class="ph">[PROFESIÓN U OFICIO]</span>, cédula nacional de identidad / RUT
N° <span class="ph">[RUT]</span>, domiciliado(a) en <span class="ph">[DOMICILIO]</span>,
a US. respetuosamente digo:</p>

<p>Que por el presente acto vengo en constituir <b>{tit}</b> denominado
<b>{p.get('code','[NOMBRE]')}</b>, de conformidad con {arts}, en la comuna de
<span class="ph">[{p.get('comuna','COMUNA')}]</span>, Región de <span class="ph">[REGIÓN]</span>,
con las siguientes características:</p>

<p><b>Punto medio de la cara norte</b> (coordenadas UTM, Datum
<span class="ph">[PSAD56 / SIRGAS]</span>, Huso {huso}):
Este {cn.get('E_centro','—'):,} m, Norte {cn.get('N','—'):,} m.</p>

<p><b>Dimensiones:</b> lado en sentido Este-Oeste {lados.get('E-W','—'):,} metros;
lado en sentido Norte-Sur {lados.get('N-S','—'):,} metros. <b>Superficie:</b>
{p.get('area_ha','—')} hectáreas. Los lados están orientados norte-sur y este-oeste
según los ejes de la proyección UTM, conforme a la ley.</p>

<p><b>Vértices</b> (UTM, Huso {huso}):</p>
<table><tr><th>Vértice</th><th>Este (m)</th><th>Norte (m)</th></tr>{vert_rows}</table>

<p class="small center" style="font-size:9pt;color:#555">{regla}</p>

<p><b>Por tanto,</b> conforme a lo expuesto y a las normas del Código de Minería,</p>
<p><b>Ruego a US.:</b> tener por constituido el presente {tit} en los términos
señalados, ordenando las inscripciones, publicaciones y trámites que en derecho
correspondan.</p>

<div class="firma">
_______________________________________<br>
<span class="ph">[NOMBRE Y FIRMA DEL PETICIONARIO]</span><br>
RUT <span class="ph">[RUT]</span>
</div>

<div class="guard"><b>BORRADOR — no es la presentación oficial.</b> Documento generado por
GeoCapitals como apoyo técnico. Requiere revisión y patrocinio de abogado(a) de minería,
verificación de vacancia y prioridad en la <b>Oficina Judicial Virtual</b>, estudio de
títulos y, donde aplique, consulta indígena (Convenio 169 OIT). La geometría proviene de
{p.get('code','—')} (fuente catastral SERNAGEOMIN, vacancia indicativa). Confirmar el Datum
oficial por huso antes de presentar. No constituye asesoría legal.</div>
</body></html>"""

    out_html = Path(f"/tmp/escrito_{p.get('code','ped')}.html")
    out_html.write_text(HTML)
    out_pdf = Path(f"/home/user/prospecto-palmeritas/geocapitals-docs/out/GEOCAPITALS_Escrito_{tipo}_{p.get('code','ped')}.pdf")
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    chromium = "/opt/pw-browsers/chromium" if Path("/opt/pw-browsers/chromium").exists() else "chromium"
    r = subprocess.run([chromium, "--headless=new", "--no-sandbox", "--disable-gpu",
                        "--print-to-pdf-no-header", f"--print-to-pdf={out_pdf}", f"file://{out_html}"],
                       capture_output=True, text=True, timeout=120)
    print("rc", r.returncode, "->", out_pdf.name, out_pdf.stat().st_size if out_pdf.exists() else "MISSING", "bytes")


if __name__ == "__main__":
    main()
