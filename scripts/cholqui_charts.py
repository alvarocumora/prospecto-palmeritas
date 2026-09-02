"""Gráficos del Investment Deck Proyecto Cholqui.

Fuentes: Analisis_economico_Proyecto_Cholqui_{1,5|2|2,5|3}.xlsx (hoja "Eva. Eco.")
y Prospecto "Cholqui" (Juan Arcos Vidal, Ph.D., 20-01-2025), Tabla 1.
No se generan datos sintéticos: todo proviene de esas fuentes.
"""

import json
import matplotlib

matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt

INK = "#12161A"
GRAPHITE = "#1E252B"
SLATE = "#8A949C"
COPPER = "#C0703A"
SAND = "#D8CBB6"
PAPER = "#F5F2EC"
GREEN = "#2E5B4E"

for f in ("InstrumentSans-Regular", "InstrumentSans-Bold", "GeistMono-Regular"):
    fm.fontManager.addfont(f"/tmp/fonts/{f}.ttf")
plt.rcParams["font.family"] = "Instrument Sans"

ECON = json.load(open("/tmp/econ.json"))
ORDER = ["1.5", "2.0", "2.5", "3.0"]


def _style(ax, dark=True):
    fg = PAPER if dark else INK
    grid = "#2C343B" if dark else "#D9D2C6"
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(grid)
    ax.tick_params(colors=fg, labelsize=11, length=0)
    ax.grid(axis="y", color=grid, lw=0.6)
    ax.set_axisbelow(True)


def sensitivity(path):
    fig, ax = plt.subplots(figsize=(9.6, 4.4), dpi=200)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor(PAPER)
    x = range(len(ORDER))
    ing = [ECON[k]["ing_usd"] / 1e6 for k in ORDER]
    gas = [ECON[k]["gas_usd"] / 1e6 for k in ORDER]
    uti = [ECON[k]["uti_usd"] / 1e6 for k in ORDER]
    w = 0.26
    ax.bar([i - w for i in x], ing, w, color=GRAPHITE, label="Ingresos brutos")
    ax.bar(list(x), gas, w, color=SAND, label="Costos totales")
    ax.bar([i + w for i in x], uti, w, color=COPPER, label="Margen acumulado")
    for i, v in enumerate(uti):
        ax.text(i + w, v + 0.5, f"{v:.1f}", ha="center", color=COPPER,
                fontsize=11, fontweight="bold")
    ax.set_xticks(list(x))
    ax.set_xticklabels([f"{k} % Cu" for k in ORDER], fontsize=12)
    ax.set_ylabel("US$ millones · ciclo 25 meses", color=INK, fontsize=10)
    ax.set_ylim(0, 42)
    _style(ax, dark=False)
    ax.legend(frameon=False, fontsize=10, labelcolor=INK, ncol=3, loc="upper left")
    fig.tight_layout()
    fig.savefig(path, facecolor=PAPER)
    plt.close(fig)


def cumulative(path):
    fig, ax = plt.subplots(figsize=(9.6, 4.2), dpi=200)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor(PAPER)
    colors = {"1.5": SLATE, "2.0": GREEN, "2.5": GRAPHITE, "3.0": COPPER}
    for k in ORDER:
        y = [v / 1e6 for v in ECON[k]["cum_usd"]]
        ax.plot(range(len(y)), y, color=colors[k], lw=2.2, label=f"{k} % Cu")
        ax.text(len(y) - 0.6, y[-1], f" {y[-1]:.1f}", color=colors[k],
                fontsize=10, va="center", fontweight="bold")
    ax.axhline(0, color=INK, lw=1)
    ax.set_xlabel("Mes de operación (P-0 a P-24)", color=INK, fontsize=10)
    ax.set_ylabel("Flujo acumulado · US$ M", color=INK, fontsize=10)
    ax.set_xlim(0, 27)
    _style(ax, dark=False)
    ax.legend(frameon=False, fontsize=10, labelcolor=INK, ncol=4, loc="upper left")
    fig.tight_layout()
    fig.savefig(path, facecolor=PAPER)
    plt.close(fig)


# Tabla 1 del prospecto — puntos de observación y muestreo (PSAD'56, 19H)
POINTS = [
    (311173, 6252495, "P-1", "Manto La Maza"),
    (311197, 6252485, "P-2", "Veta La Maza S"),
    (311195, 6252520, "P-3", "Veta La Maza Portezuelo"),
    (310637, 6252013, "P-4", "Loma El Litre"),
    (311195, 6252325, "P-5", "Cascada El Infiernillo"),
    (310935, 6253214, "P-6", "Cuesta Ancha"),
    (310790, 6254005, "P-7", "Vetilla contacto calizas"),
    (313282, 6254140, "P-8", "Los Huevos"),
    (311418, 6252561, "P-9", "Qda. La Maza"),
    (311314, 6252642, "P-10", "Veta La Maza"),
    (310935, 6253214, "P-13", "Cuesta Ancha veta"),
    (311359, 6248708, "P-15", "Las Hoyadas"),
    (311345, 6248714, "P-16", "Las Hoyadas"),
    (311656, 6249726, "P-17", "Placeta del Padre"),
    (311593, 6249748, "P-18", "Placeta del Padre"),
    (311567, 6249745, "P-19", "Placeta del Padre"),
    (308879, 6250179, "P-20", "Los Tres Morros"),
]
MINITAS = (312833, 6254770, "Mina Las Minitas (acceso)")


def sample_map(path):
    fig, ax = plt.subplots(figsize=(7.6, 6.6), dpi=200)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor("#EDE8DE")
    xs = [p[0] for p in POINTS]
    ys = [p[1] for p in POINTS]
    ax.scatter(xs, ys, s=70, color=GREEN, zorder=3, edgecolor=PAPER, lw=1.2)
    # agrupar puntos casi coincidentes para evitar etiquetas superpuestas
    clusters = []  # [x, y, [codes]]
    for x, y, code, _ in POINTS:
        for cl in clusters:
            if abs(cl[0] - x) < 220 and abs(cl[1] - y) < 220:
                cl[2].append(code)
                break
        else:
            clusters.append([x, y, [code]])
    for x, y, codes in clusters:
        ax.annotate("/".join(codes), (x, y), textcoords="offset points", xytext=(8, 5),
                    fontsize=8, color=GRAPHITE, family="Geist Mono")

    ax.scatter([MINITAS[0]], [MINITAS[1]], s=190, marker="^", color=COPPER,
               zorder=4, edgecolor=PAPER, lw=1.2)
    ax.annotate("LAS MINITAS", (MINITAS[0], MINITAS[1]), textcoords="offset points",
                xytext=(-16, 12), fontsize=9, color=COPPER, fontweight="bold")
    ax.set_xlabel("Este · UTM PSAD'56 19H (m)", fontsize=9, color=SLATE)
    ax.set_ylabel("Norte · UTM PSAD'56 19H (m)", fontsize=9, color=SLATE)
    ax.tick_params(labelsize=7.5, colors=SLATE, length=0)
    ax.grid(color="#DCD4C6", lw=0.6)
    for s in ax.spines.values():
        s.set_color("#CFC6B5")
    ax.set_axisbelow(True)
    fig.tight_layout()
    fig.savefig(path, facecolor=PAPER)
    plt.close(fig)


if __name__ == "__main__":
    sensitivity("/tmp/ch_sens.png")
    cumulative("/tmp/ch_cum.png")
    sample_map("/tmp/ch_map.png")
    print("charts ok")
