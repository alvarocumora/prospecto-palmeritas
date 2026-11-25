"""Mapa de muestras y valor ENAMI por faena, Tilama / Los Verdes (uso interno).

Mismo criterio que el modelo de Cholqui: valor a 1,5 / 2,0 / 2,5 % Cu, separando
óxido (tarifa de lixiviación, no paga Au ni Ag) y sulfuro (tarifa de flotación, paga
Cu, Au y Ag). Todo es referencial: tarifas ENAMI publicadas, no cotización; leyes de
muestras puntuales, no recurso ni reserva.

Entradas:
  docs/tilama/historico/muestras_TIL_3AAA_2022.csv          (WGS84 19S)
  docs/tilama/pedimentos/presentado/anomalias_vs_concesiones_15-11-2026.csv
  docs/tilama/geomin/sigex_cerro_bayo_tilama_las_cenizas_2021.csv
  /tmp/claude-0/ped/prox/base.pkl                            (catastro y piezas)
Salida: docs/tilama/tilama_mapa_valor_faenas_<fecha>.pdf
"""
import csv, pickle, statistics as st, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.lines import Line2D

R = "/home/claude/prospecto-palmeritas/docs/tilama/"
FECHA = sys.argv[1] if len(sys.argv) > 1 else "21-11-2026"
INK, COPPER, PAPER, SLATE, GREEN, SAND = "#12161A", "#C0703A", "#F5F2EC", "#8A949C", "#2E5B4E", "#D8CBB6"
plt.rcParams.update({"font.family": "Inter", "font.size": 9})

# ---------------- tarifas ENAMI (CLP por tonelada seca) ----------------
OX_REF, OX_PT = 171886, 82315            # Circular N°27, jul-2026, 2,5 % CuS
SU_REF, SU_PT = 217016, 103482           # flotación, jun-2026, 2,5 % Cu
AU_REF, AU_G, AU_PG = 380900, 5, 84566   # 5 g/t
AG_REF, AG_G, AG_PG = 440183, 350, 1377  # 350 g/t
RET = 0.04
T_MES = 2000
COSTO_FIJO = 30e6 + 15e6 + 10e6          # equipos + personal + administración ($/mes)
COSTO_T = 10000 + 11000                  # tronadura/combustible + flete ($/t)

ox = lambda cus: OX_REF + (cus - 2.5) * OX_PT
su_cu = lambda cu: SU_REF + (cu - 2.5) * SU_PT
au = lambda g: max(0.0, AU_REF + (g - AU_G) * AU_PG)
ag = lambda g: max(0.0, AG_REF + (g - AG_G) * AG_PG)
num = lambda s: float(str(s).replace("<", "").replace(",", ".")) if s not in (None, "", "—") else None

# ---------------- muestras ----------------
til = list(csv.DictReader(open(R + "historico/muestras_TIL_3AAA_2022.csv", encoding="utf-8-sig"), delimiter=";"))
emt = list(csv.DictReader(open(R + "pedimentos/presentado/anomalias_vs_concesiones_15-11-2026.csv", encoding="utf-8-sig"), delimiter=";"))
cb = list(csv.DictReader(open(R + "geomin/sigex_cerro_bayo_tilama_las_cenizas_2021.csv")))

def med(v):
    v = [x for x in v if x is not None]
    return st.median(v) if v else None

T = {r["muestra"]: r for r in til}
E = {r["muestra"]: r for r in emt}
def tilset(ids): return [T[i] for i in ids]
def emtset(ids): return [E[i] for i in ids if i in E]

# faenas: nombre, (E, N) WGS84, muestras, titular / situación, nota
FAENAS = [
    ("La Castellana", (301103, 6454455), tilset(["TIL2A", "TIL2B", "TIL2C"]), [], "LOS VERDES 5 · Fernández (compra)", "Óxido con Au y Ag altos"),
    ("Los Verdes 4 · TOO-220", (302025, 6453773), tilset(["TIL1A", "TIL1B", "TIL1C"]), emtset(["TOO-220"]), "LOS VERDES 4 · Fernández (compra)", "Mixto óxido/sulfuro, Ag alta"),
    ("Alto Los Verdes 2", (300390, 6455200), tilset(["TIL4A", "TIL4B", "TIL4C"]), [], "ALTO LOS VERDES 2 · Fernández (anexo)", "Óxido con Au"),
    ("Granero · ex M. Tilama Norte", (300527, 6452753), tilset(["TIL5A", "TIL5B", "TIL5C", "TIL6"]), [], "PEUMO 1/20 (compra) + PLAZETAS 2", "ENAMI 2004-05: 570 t a 2,68 % CuS"),
    ("Mandela", (297369, 6454397), tilset(["TIL7A", "TIL7B", "TIL7C"]), [], "MANDELA · tercero", "Sulfuro (CuS < 0,2 %)"),
    ("Chele Norte", (297294, 6453332), tilset(["TIL8A", "TIL8B", "TIL8C", "TIL8D"]), [], "CHELE NORTE · tercero", "Mixto, sin Ag"),
    ("Expansión", (301230, 6455220), [], emtset(["TOO-183", "TOO-184"]), "EXPANCION 1/12 · Minera AGV", "En operación; Ag bajo detección"),
    ("Las Trancas", (301650, 6451650), [], emtset(["TOO-233", "TOO-203", "TOO-201", "TOO-189", "TOO-207"]), "LAS TRANCAS · Soc. Expl. Mineras", "Ag en TOO-201 (57 g/t)"),
    ("Cerro Bayo (Las Cenizas)", (307700, 6448500), [], [], "Ex TILAMA 1/6 · hoy MARTINA 50/90/91", "32 muestras SIGEX 2021, óxido"),
]

rows = []
for nombre, xy, ts, es, tit, nota in FAENAS:
    if nombre.startswith("Cerro Bayo"):
        cut = med([num(r["cut"]) for r in cb]); cus = med([num(r["cus"]) for r in cb])
        agv = med([num(r["ag"]) for r in cb]); auv = med([num(r["au"]) for r in cb]); n = len(cb)
    else:
        cut = med([num(r["CuT_pct"]) for r in ts] + [num(r["cu_pct"]) for r in es])
        cus = med([num(r["CuSol_pct"]) for r in ts])
        agv = med([num(r["Ag_gt"]) for r in ts] + [num(r["ag_ppm"]) for r in es if num(r["ag_ppm"]) and num(r["ag_ppm"]) > 0.15])
        auv = med([num(r["Au_gt"]) for r in ts])
        n = len(ts) + len(es)
    rows.append(dict(nombre=nombre, xy=xy, tit=tit, nota=nota, n=n, cut=cut, cus=cus, ag=agv or 0, au=auv or 0))

LEYES = [1.5, 2.0, 2.5]
for r in rows:
    r["su"] = {l: su_cu(l) + au(r["au"]) + ag(r["ag"]) for l in LEYES}
OXV = {l: ox(l) for l in LEYES}

def mes(v):
    neto = v * T_MES * (1 - RET)
    return neto, neto - COSTO_FIJO - COSTO_T * T_MES

fm = lambda x: f"{x:,.0f}".replace(",", ".")
fmM = lambda x: f"{x/1e6:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".")
fg = lambda x, d=2: "—" if x is None else f"{x:.{d}f}".replace(".", ",")

# ---------------- catastro ----------------
ours, cat = pickle.load(open("/tmp/claude-0/ped/prox/base.pkl", "rb"))
COMPRA = {"LOS VERDES 4 1/10", "LOS VERDES 5 1/12", "PEUMO 1/20"}
ANEXO = {"LOS VERDES 3 1/20", "ALTO LOS VERDES 2 1/15", "LAS TRANCAS1/20", "EL ALTO", "EL CANELO", "PLAZETAS"}
OFF = {"Cerro Bayo (Las Cenizas)": (-185, 12), "Alto Los Verdes 2": (-150, 6), "Expansión": (12, 10), "La Castellana": (12, -4), "Granero · ex M. Tilama Norte": (12, -14)}
X0, X1, Y0, Y1 = 295500, 309000, 6446700, 6457000

with PdfPages(R + f"tilama_mapa_valor_faenas_{FECHA}.pdf") as pdf:
    # ======== página 1: mapa ========
    fig = plt.figure(figsize=(16.5, 11.7)); fig.patch.set_facecolor(PAPER)
    ax = fig.add_axes([0.04, 0.07, 0.66, 0.84]); ax.set_facecolor("#3A3F44")
    SAT = "/tmp/claude-0/ped/sat_tilama_4m.png"  # Esri World Imagery reproyectado a UTM 19S (ver tilama_imagenes.py)
    import os
    if os.path.exists(SAT):
        from PIL import Image as _I; ax.imshow(_I.open(SAT), extent=(295500, 309500, 6446500, 6457000), zorder=0)
    for c in cat:
        if c["sit"] == "ELIMINADA": continue
        b = c["g"].bounds
        if b[2] < X0 or b[0] > X1 or b[3] < Y0 or b[1] > Y1: continue
        x, y = c["g"].exterior.xy if c["g"].geom_type == "Polygon" else c["g"].convex_hull.exterior.xy
        if c["n"] in COMPRA: ax.fill(x, y, color=COPPER, alpha=.30, lw=2, ec="#FF9A4D", zorder=3)
        elif c["n"] in ANEXO: ax.fill(x, y, color=SAND, alpha=.28, lw=1, ec="#F2D29B", zorder=2)
        else: ax.plot(x, y, color="white", lw=.45, alpha=.45, zorder=1)
    for o in ours:
        if "caducar" in o.get("estado", ""): continue
        x, y = o["g"].exterior.xy; ax.plot(x, y, color="#7CFC9A", lw=1.0, ls="--", zorder=4)
    for nm, a, b, c_, d in [("M50", 306300, 307300, 6444675, 6447675), ("M90", 306800, 307800, 6448675, 6450675), ("M91", 307800, 308800, 6449175, 6450175), ("M86", 305800, 306800, 6448575, 6449575), ("M87", 305800, 307800, 6450675, 6451675)]:
        ax.plot([a, b, b, a, a], [c_, c_, d, d, c_], color="#7CFC9A", lw=1.8, zorder=5)
    def col(cu): return "#B22222" if cu >= 3 else COPPER if cu >= 1 else "#E3B341" if cu >= .3 else SLATE
    for r in til: ax.scatter(float(r["E_WGS84"]), float(r["N_WGS84"]), s=60, c=col(num(r["CuT_pct"])), ec=INK, lw=.6, marker="o", zorder=7)
    for r in emt:
        e, n_ = float(r["E_sngm"]), float(r["N_sngm"])
        if X0 < e < X1 and Y0 < n_ < Y1: ax.scatter(e, n_, s=26, c=col(num(r["cu_pct"])), ec=INK, lw=.4, marker="^", zorder=6)
    for r in cb: ax.scatter(float(r["E"]), float(r["N"]), s=26, c=col(num(r["cut"])), ec=INK, lw=.4, marker="s", zorder=6)
    for i, r in enumerate(rows, 1):
        e, n_ = r["xy"]
        ax.scatter(e, n_, s=420, marker="*", c="#FFD23F", ec=INK, lw=1, zorder=9)
        ax.annotate(f"{i}. {r['nombre']}", (e, n_), xytext=OFF.get(r["nombre"], (10, 8)), textcoords="offset points", fontsize=9.5, weight="bold", color=INK, zorder=10,
                    bbox=dict(boxstyle="round,pad=.25", fc="white", ec="none", alpha=.85))
    ax.set_xlim(X0, X1); ax.set_ylim(Y0, Y1); ax.set_aspect("equal")
    ax.ticklabel_format(style="plain", useOffset=False); ax.tick_params(labelsize=7.5, colors=SLATE)
    ax.grid(color="white", lw=.4, alpha=.25); ax.set_xlabel("Este (m) · WGS84 UTM 19S", color=SLATE); ax.set_ylabel("Norte (m)", color=SLATE)
    ax.plot([X1 - 2600, X1 - 600], [Y0 + 500] * 2, color="white", lw=3); ax.text(X1 - 1600, Y0 + 650, "2 km", ha="center", fontsize=8, color="white", weight="bold")
    fig.text(0.04, 0.95, "Tilama / Los Verdes · muestras y faenas sobre imagen satelital", fontsize=20, weight="bold", color=INK)
    fig.text(0.04, 0.925, f"Uso interno · {FECHA} · leyes de muestras puntuales, no recurso ni reserva · no compartir con peritos ni terceros · imagen Esri World Imagery", fontsize=9.5, color=SLATE)
    leg = [Line2D([], [], marker="*", ls="", mfc="#FFD23F", mec=INK, ms=15, label="Faena (numerada en la tabla)"),
           Line2D([], [], marker="o", ls="", mfc=COPPER, mec=INK, ms=8, label="Muestra TIL 2022 (3AAA)"),
           Line2D([], [], marker="^", ls="", mfc=COPPER, mec=INK, ms=7, label="Muestra EMT / Esterio"),
           Line2D([], [], marker="s", ls="", mfc=COPPER, mec=INK, ms=7, label="Muestra Las Cenizas 2021 (SIGEX)"),
           Line2D([], [], marker="o", ls="", mfc="#B22222", mec=INK, ms=7, label="Cu ≥ 3 %"),
           Line2D([], [], marker="o", ls="", mfc=COPPER, mec=INK, ms=7, label="Cu 1–3 %"),
           Line2D([], [], marker="o", ls="", mfc="#E3B341", mec=INK, ms=7, label="Cu 0,3–1 %"),
           Line2D([], [], marker="o", ls="", mfc=SLATE, mec=INK, ms=7, label="Cu < 0,3 %"),
           plt.Rectangle((0, 0), 1, 1, fc=COPPER, alpha=.35, ec=COPPER, label="Compra Fernández (LV4, LV5, Peumo)"),
           plt.Rectangle((0, 0), 1, 1, fc=SAND, ec="#F2D29B", label="Derecho preferente / anexos"),
           Line2D([], [], color="#7CFC9A", ls="--", label="Nuestras solicitudes"),
           Line2D([], [], color="#9AA3AA", label="Otras concesiones vigentes")]
    ax.legend(handles=leg, loc="lower left", fontsize=8, framealpha=.92)
    # panel lateral
    ay = fig.add_axes([0.72, 0.07, 0.26, 0.84]); ay.axis("off")
    ay.text(0, 1, "Faenas · leyes de muestras (mediana)", fontsize=12, weight="bold", va="top")
    yy = .955
    for i, r in enumerate(rows, 1):
        ay.text(0, yy, f"{i}. {r['nombre']}", fontsize=9.5, weight="bold", va="top")
        ay.text(0, yy - .022, f"{r['tit']}", fontsize=8, color=SLATE, va="top")
        ay.text(0, yy - .042, f"n={r['n']} · CuT {fg(r['cut'])} % · CuS {fg(r['cus'])} % · Ag {fg(r['ag'],0)} g/t · Au {fg(r['au'])} g/t", fontsize=8.3, va="top")
        ay.text(0, yy - .062, r["nota"], fontsize=8, color=COPPER, va="top", style="italic")
        yy -= .102
    pdf.savefig(fig, facecolor=PAPER); plt.close(fig)

    # ======== página 2: valor por tonelada ========
    fig = plt.figure(figsize=(16.5, 11.7)); fig.patch.set_facecolor(PAPER)
    fig.text(0.04, 0.95, "Valor ENAMI por tonelada seca a 1,5 · 2,0 · 2,5 % Cu", fontsize=20, weight="bold", color=INK)
    fig.text(0.04, 0.925, "Óxido: tarifa de lixiviación (Circular N°27, jul-2026), paga solo Cu soluble. Sulfuro: tarifa de flotación (jun-2026), paga Cu, Au y Ag; Au y Ag a la ley mediana de cada faena.", fontsize=9.5, color=SLATE)
    ax = fig.add_axes([0.04, 0.10, 0.92, 0.79]); ax.axis("off")
    head = ["Faena", "Au g/t", "Ag g/t", "Óxido 1,5", "Óxido 2,0", "Óxido 2,5", "Sulfuro 1,5", "Sulfuro 2,0", "Sulfuro 2,5", "Au+Ag en sulfuro"]
    cells = []
    for i, r in enumerate(rows, 1):
        cells.append([f"{i}. {r['nombre']}", fg(r["au"]), fg(r["ag"], 0)] + [fm(OXV[l]) for l in LEYES] + [fm(r["su"][l]) for l in LEYES] + [fm(au(r["au"]) + ag(r["ag"]))])
    tb = ax.table(cellText=cells, colLabels=head, loc="upper center", cellLoc="right", colLoc="center",
                  colWidths=[.22, .06, .06, .085, .085, .085, .095, .095, .095, .11])
    tb.auto_set_font_size(False); tb.set_fontsize(10); tb.scale(1, 2.1)
    for (i, j), c in tb.get_celld().items():
        c.set_edgecolor("#D9D2C6")
        if i == 0: c.set_facecolor(INK); c.get_text().set_color(PAPER); c.get_text().set_weight("bold")
        elif j == 0: c.get_text().set_ha("left"); c._loc = "left"
        if i > 0 and 3 <= j <= 5: c.set_facecolor("#F1E5D8")
        if i > 0 and 6 <= j <= 8: c.set_facecolor("#E3ECE8")
    ax.text(0, .30, "Cómo leer la tabla", fontsize=12, weight="bold", transform=ax.transAxes)
    txt = ("Cifras en pesos por tonelada seca, antes de la retención de 4 % y sin costos. La columna de óxido es igual para todas las faenas porque la tarifa de lixiviación no "
           "paga oro ni plata.\nEl sulfuro paga el cobre por flotación y suma el oro y la plata: por eso La Castellana (Au 7,5 g/t, Ag 188 g/t) vale varias veces más como sulfuro "
           "que como óxido,\naunque su cobre sea soluble. Antes de entregar La Castellana hay que preguntarle a ENAMI si recibe un óxido con oro en la tarifa de flotación o en otra línea.\n"
           "Oro y plata se pagan desde ~0,5 g/t Au y ~30 g/t Ag (bajo eso la fórmula lineal da cero). Mezclar óxido con sulfuro castiga ambos: Los Verdes 3 liquidó 1,9 % CuT en su primera entrega de 300 t.\n"
           "Mandela es sulfuro y Chele Norte es mixto: solo valen en la línea de flotación. Expansión y Las Trancas no tienen Au analizado: su sulfuro está subvalorado.")
    ax.text(0, .27, txt, fontsize=9.5, va="top", transform=ax.transAxes, linespacing=1.6)
    pdf.savefig(fig, facecolor=PAPER); plt.close(fig)

    # ======== página 3: flujo mensual a 2.000 t ========
    fig = plt.figure(figsize=(16.5, 11.7)); fig.patch.set_facecolor(PAPER)
    fig.text(0.04, 0.95, f"Ingreso y margen mensual a {fm(T_MES)} t secas/mes", fontsize=20, weight="bold", color=INK)
    fig.text(0.04, 0.925, f"Ingreso neto de la retención de 4 %. Margen indicativo con costos del flujo de la planilla: equipos, personal y administración \\${fmM(COSTO_FIJO)} M/mes, tronadura y flete \\${fm(COSTO_T)}/t. Antes del 8 % a Fernández.", fontsize=9.5, color=SLATE)
    ax = fig.add_axes([0.06, 0.40, 0.9, 0.48])
    labels = ["Óxido (todas)"] + [f"{i}. {r['nombre']}" for i, r in enumerate(rows, 1)]
    import numpy as np
    xs = np.arange(len(labels)); w = .26
    for k, (l, cc) in enumerate(zip(LEYES, ["#E3B341", COPPER, "#8E3B12"])):
        vals = [mes(OXV[l])[1] / 1e6] + [mes(r["su"][l])[1] / 1e6 for r in rows]
        ax.bar(xs + (k - 1) * w, vals, w, color=cc, label=f"{fg(l,1)} % Cu")
    ax.axhline(0, color=INK, lw=.8)
    ax.set_xticks(xs); ax.set_xticklabels(labels, rotation=28, ha="right", fontsize=8.5)
    ax.set_ylabel("Margen indicativo ($ millones/mes)"); ax.grid(axis="y", color="#D9D2C6"); ax.set_axisbelow(True)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    ax.legend(title="Ley de venta", fontsize=9)
    ax2 = fig.add_axes([0.06, 0.05, 0.9, 0.22]); ax2.axis("off")
    hd = ["", "Ingreso 1,5 %", "Margen 1,5 %", "Ingreso 2,0 %", "Margen 2,0 %", "Ingreso 2,5 %", "Margen 2,5 %"]
    cl = [["Óxido (todas las faenas)"] + sum([[fmM(mes(OXV[l])[0]), fmM(mes(OXV[l])[1])] for l in LEYES], [])]
    for i, r in enumerate(rows, 1):
        if r["nombre"] in ("La Castellana", "Los Verdes 4 · TOO-220", "Alto Los Verdes 2", "Granero · ex M. Tilama Norte", "Cerro Bayo (Las Cenizas)"):
            cl.append([f"Sulfuro · {i}. {r['nombre']}"] + sum([[fmM(mes(r["su"][l])[0]), fmM(mes(r["su"][l])[1])] for l in LEYES], []))
    tb = ax2.table(cellText=cl, colLabels=hd, loc="upper center", cellLoc="right", colWidths=[.28] + [.12] * 6)
    tb.auto_set_font_size(False); tb.set_fontsize(9.5); tb.scale(1, 1.6)
    for (i, j), c in tb.get_celld().items():
        c.set_edgecolor("#D9D2C6")
        if i == 0: c.set_facecolor(INK); c.get_text().set_color(PAPER)
        elif j == 0: c.get_text().set_ha("left"); c._loc = "left"
    fig.text(0.06, 0.012, "La Castellana: la mediana de oro (7,5 g/t) sale de solo 3 muestras de roca, una con 38 g/t; su barra muestra el potencial si esa ley se sostiene, no una ley de mina.\n\\$ millones por mes. Referencial: tarifas ENAMI publicadas (no cotización), leyes de muestras de superficie, sin dilución, recuperación ni consumo de ácido. No es recurso, reserva ni proyección de producción.", fontsize=8.5, color=SLATE)
    pdf.savefig(fig, facecolor=PAPER); plt.close(fig)
print("ok")
