"""PROYECTO CHOLQUI — Investment Deck GeoCapitals (16:9, colorimetría oficial).

Colorimetría Institutional Modernist de GeoCapitals: papel hueso (#F5F2EC),
tinta (#12161A), cobalto (#2447D6), cobre (#C0703A), hairline (#E3E0D8).

Regla de contenido: TODA cifra proviene de src/features/franco/data/cholqui.ts
(fuente única de la plataforma), alimentada por el Prospecto Cholqui
(Arcos / Leman), el Informe de Ensayo AG2463714 (Andes Analytical Assay), la
Circular ENAMI N°27 de julio 2026, el análisis económico del proyecto y los
certificados de garantías. No se declaran recursos ni reservas; no hay VAN/TIR.

Uso: python3 scripts/cholqui_deck_gc.py
"""

import subprocess

import qrcode
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas

W, H = 1280, 720
OUT = "/mnt/documents/Proyecto_Cholqui_Deck_GeoCapitals.pdf"
LIVE_URL = "https://geocapitals.com/live/franco"

INK = HexColor("#12161A")
PAPER = HexColor("#F5F2EC")
PAPER_2 = HexColor("#EDE8DE")
COBALT = HexColor("#2447D6")
COBALT_SOFT = HexColor("#DCE2FA")
COPPER = HexColor("#C0703A")
SLATE = HexColor("#6E767E")
SLATE_L = HexColor("#9AA4AC")
HAIR = HexColor("#E3E0D8")
HAIR_DARK = HexColor("#2A3138")
WARN = HexColor("#8A5A12")

# --------------------------------------------------------------------- fuentes
def _font(query):
    return subprocess.check_output(["fc-match", "-f", "%{file}", query], text=True).strip()


pdfmetrics.registerFont(TTFont("Sans", _font("DejaVu Sans")))
pdfmetrics.registerFont(TTFont("Sans-B", _font("DejaVu Sans:bold")))
pdfmetrics.registerFont(TTFont("Sans-I", _font("DejaVu Sans:italic")))
pdfmetrics.registerFont(TTFont("Mono", _font("DejaVu Sans Mono")))
pdfmetrics.registerFont(TTFont("Mono-B", _font("DejaVu Sans Mono:bold")))

c = rl_canvas.Canvas(OUT, pagesize=(W, H))
c.setTitle("Proyecto Cholqui · Investment Deck · GeoCapitals")
c.setAuthor("GeoCapitals")
c.setSubject("Cu-Au-Ag · Melipilla, Región Metropolitana, Chile")
PAGE = {"n": 0}


# ------------------------------------------------------------------ primitivas
def bg(color=PAPER):
    c.setFillColor(color)
    c.rect(0, 0, W, H, stroke=0, fill=1)


def text(x, y, s, font="Sans", size=12, color=INK, align="l"):
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "c":
        c.drawCentredString(x, y, s)
    elif align == "r":
        c.drawRightString(x, y, s)
    else:
        c.drawString(x, y, s)


def lines(s, width, font="Sans", size=12):
    out, line = [], ""
    for w_ in s.split():
        t = (line + " " + w_).strip()
        if pdfmetrics.stringWidth(t, font, size) > width and line:
            out.append(line)
            line = w_
        else:
            line = t
    out.append(line)
    return out


def wrap(x, y, s, width, font="Sans", size=12, color=INK, leading=None):
    leading = leading or size * 1.42
    ls = lines(s, width, font, size)
    for i, ln in enumerate(ls):
        text(x, y - i * leading, ln, font, size, color)
    return y - (len(ls) - 1) * leading


def rule(x, y, w_, color=HAIR, lw=1):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x, y, x + w_, y)


def box(x, y, w_, h_, fill=None, stroke=HAIR, lw=1, radius=0):
    if fill:
        c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
    c.setLineWidth(lw)
    args = dict(stroke=1 if stroke else 0, fill=1 if fill else 0)
    if radius:
        c.roundRect(x, y, w_, h_, radius, **args)
    else:
        c.rect(x, y, w_, h_, **args)


def header(kicker, title, sub=None):
    bg()
    box(0, H - 8, W, 8, fill=COBALT, stroke=None)
    text(72, H - 62, kicker.upper(), "Mono-B", 10, COBALT)
    text(72, H - 100, title, "Sans-B", 27, INK)
    rule(72, H - 116, 84, COBALT, 2.6)
    if sub:
        return wrap(72, H - 142, sub, 1100, "Sans-I", 12.5, SLATE, 17)
    return H - 130


def footer(source):
    PAGE["n"] += 1
    rule(72, 54, W - 144, HAIR)
    text(72, 36, source, "Mono", 7.6, SLATE_L)
    text(W - 72, 36, f"GEOCAPITALS · PROYECTO CHOLQUI · {PAGE['n']:02d}", "Mono", 7.6, SLATE_L, "r")
    c.showPage()


def metric(x, y, value, label, note=None, w_=250, vsize=30, color=COBALT):
    text(x, y, value, "Sans-B", vsize, color)
    text(x, y - 20, label.upper(), "Mono", 8.4, INK)
    if note:
        wrap(x, y - 38, note, w_, "Sans", 9.4, SLATE, 12.5)


def table(x, y, cols, rows, widths, size=9.6, row_h=26, head_fill=PAPER_2, zebra=True):
    tw = sum(widths)
    box(x, y - 24, tw, 24, fill=head_fill, stroke=None)
    cx = x
    for i, col in enumerate(cols):
        align = "r" if i and isinstance(col, str) and col.startswith(">") else "l"
        label = col[1:] if col.startswith(">") else col
        text(
            cx + (widths[i] - 10 if align == "r" else 10),
            y - 16,
            label.upper(),
            "Mono-B",
            7.8,
            COBALT,
            align,
        )
        cx += widths[i]
    yy = y - 24
    for r, row in enumerate(rows):
        h_ = row_h
        cells = []
        for i, cell in enumerate(row):
            ls = lines(str(cell).lstrip(">"), widths[i] - 20, "Sans", size)
            cells.append(ls)
            h_ = max(h_, 14 + len(ls) * (size * 1.3))
        if zebra and r % 2:
            box(x, yy - h_, tw, h_, fill=HexColor("#FAF8F4"), stroke=None)
        cx = x
        for i, ls in enumerate(cells):
            right = str(row[i]).startswith(">")
            for j, ln in enumerate(ls):
                text(
                    cx + (widths[i] - 10 if right else 10),
                    yy - 16 - j * (size * 1.3),
                    ln,
                    "Mono" if right else "Sans",
                    size,
                    INK,
                    "r" if right else "l",
                )
            cx += widths[i]
        rule(x, yy - h_, tw, HAIR)
        yy -= h_
    return yy


def bullets(x, y, items, width=1100, size=11.5, gap=22, color=INK, marker=COBALT):
    for it in items:
        text(x, y, "—", "Sans-B", size, marker)
        y = wrap(x + 20, y, it, width - 20, "Sans", size, color, size * 1.45) - gap
    return y


def note_box(x, y, w_, s, tone=PAPER_2, fg=SLATE, bar=COBALT):
    ls = lines(s, w_ - 34, "Sans", 9.6)
    h_ = 18 + len(ls) * 13
    box(x, y - h_, w_, h_, fill=tone, stroke=None)
    box(x, y - h_, 3, h_, fill=bar, stroke=None)
    for i, ln in enumerate(ls):
        text(x + 16, y - 16 - i * 13, ln, "Sans", 9.6, fg)
    return y - h_


def bar_chart(x, y, w_, h_, data, fmt, highlight=None):
    """data: [(label, value)] — barras horizontales cobalto."""
    mx = max(v for _, v in data) or 1
    n = len(data)
    bh = min(26, (h_ - (n - 1) * 12) / n)
    yy = y
    for label, v in data:
        yy -= bh
        text(x, yy + bh / 2 - 4, label, "Mono", 9, INK)
        bw = max(2, (w_ - 210) * v / mx)
        box(x + 88, yy, bw, bh, fill=COBALT if label == highlight else HexColor("#B9C4EE"), stroke=None)
        text(x + 96 + bw, yy + bh / 2 - 4, fmt(v), "Mono", 8.8, SLATE)
        yy -= 12
    return yy


# ------------------------------------------------------------------- datos
SCENARIOS = [
    ("1,5 % Cu sol.", 89_571, 14_913_571_500, 8_911_198_950, 6_002_372_550, "Mes 9"),
    ("2,0 % Cu sol.", 130_728, 21_766_212_000, 8_911_198_950, 12_855_013_050, "No modelado"),
    ("2,5 % Cu sol.", 171_886, 28_619_019_000, 8_911_198_950, 19_707_820_050, "No modelado"),
    ("3,0 % Cu sol.", 213_044, 35_471_826_000, 8_911_198_950, 26_560_627_050, "No modelado"),
]
ASSAYS = [
    ("P1", "Manto La Maza", 1.781, 1.682, 0.04, 38),
    ("P2", "Veta principal La Maza", 7.187, 6.054, 0.08, 15),
    ("P3", "Veta principal La Maza", 16.227, 14.351, 0.25, 54),
]
POINTS = [
    ("P-1", "Manto La Maza — N20ºE/30ºSE, pot. 1,1–1,3 m", 311173, 6252495),
    ("P-2", "Veta principal La Maza — N10ºW/90º, pot. 1,0–1,5 m", 311197, 6252485),
    ("P-3", "Veta La Maza, portezuelo — N10ºW/65ºW", 311195, 6252520),
    ("P-5", "Cascada El Infiernillo — veta N15ºE/90º, pot. 0,60 m", 311195, 6252325),
    ("P-6", "Cuesta Ancha — desmonte de carbonatos", 310935, 6253214),
    ("P-7", "Contacto calizas / ocoítas — vetilla N15ºE/35-38ºE", 310790, 6254005),
    ("P-9", "Quebrada La Maza — veta cuarzosa", 311418, 6252561),
    ("P-13", "Cuesta Ancha — veta N08ºW/90º, pot. 1 m", 310935, 6253214),
    ("P-17", "Placeta del Padre — zona de alteración argílica", 311656, 6249726),
    ("P-19", "Placeta del Padre — vetilla N50ºE/90º, pot. 1,5–2,0 m", 311567, 6249745),
    ("P-20", "Los Tres Morros — pique, veta N65ºW/90º, pot. 2 m", 308879, 6250179),
]
GAPS = [
    "El plan de 166.500 t excede 2,74 veces el potencial conceptual de 60.750 t: el inventario debe ampliarse antes de comprometer capital.",
    "Tarifa desactualizada en el archivo económico original (CLP 65.438/t de nov-2025 frente a CLP 89.571/t de julio 2026).",
    "Arriendo de camiones registrado como 167 unidades × CLP 600.000/mes mientras el plan minero indica 2 a 5 camiones: unidad por aclarar.",
    "Sin ensayos metalúrgicos de consumo de ácido, recuperación, granulometría, cinética de lixiviación ni variabilidad.",
    "Faltan permisos, patentes, cierre, seguros, topografía, explosivos, administración, capital de trabajo y costo financiero.",
    "Ruta logística sin agencia o planta ENAMI receptora identificada, distancia, tarifa de transporte ni ley mínima de recepción.",
    "Discrepancia de titularidad: la presentación declara 20 pedimentos y 15 pertenencias; el contrato comercial enumera 10 pertenencias.",
]
MILESTONES = [
    ("0–15 días", "Matriz de pertenencias, vigencias, patentes y contratos; saneamiento del embargo TGR"),
    ("0–30 días", "Topografía, mapeo geológico-estructural, canales y protocolo QA/QC"),
    ("15–45 días", "Sondajes prioritarios en La Maza y ensayos metalúrgicos (ácido, recuperación, cinética)"),
    ("30–60 días", "Empadronamiento ENAMI, carta de aceptación comercial y lote piloto"),
    ("45–90 días", "Plan minero, modelo financiero auditado, tasaciones y contratos de garantía"),
]
USE_OF_FUNDS = [
    ("Sondajes y ampliación de inventario (La Maza)", 40),
    ("Ensayos metalúrgicos y plan minero", 20),
    ("Saneamiento legal, títulos y patentes", 20),
    ("Topografía, mapeo, canales y zanjas", 15),
    ("Administración", 5),
]
GUARANTEES = [
    ("Lote 1, Rol 16-32, Isla de Maipo", "Inversiones RFG SpA", "124.141.101", "Sin hipoteca informada"),
    ("Lote 2, Rol 16-33, Isla de Maipo", "Inversiones RFG SpA", "124.141.101", "Embargo TGR — no elegible"),
    ("Predio agrícola Rol 119-40, 10,76 ha", "50 % Inversiones RFG SpA", "188.882.984", "Revisar copropiedad"),
    ("25 acciones de agua Canal Valdés", "Inversiones RFG SpA", "Sin tasación", "Dominio vigente, sin gravámenes"),
]
CAVEATS = [
    "No existe estimación de recursos ni reservas bajo un estándar reconocido (CH 20235 / NI 43-101 / JORC / S-K 1300). Las 60.750 t son potencial geológico conceptual del prospecto.",
    "Las leyes certificadas provienen de tres muestras puntuales de superficie (Informe AG2463714): no permiten estimar ley media de mina, dilución, continuidad, recuperación ni variabilidad.",
    "La producción de Mina Las Minitas es de un tercero (RG Minerals SpA); se cita como evidencia de continuidad estructural, no como producción propia.",
    "Las cifras económicas son ilustrativas a tarifa ENAMI julio 2026 y no incorporan ajustes metalúrgicos, impuestos, financiamiento, permisos, cierre ni seguros. No hay VAN ni TIR en la fuente.",
    "Los avalúos fiscales de las garantías no equivalen a tasación comercial ni a valor de realización; el Lote 2 mantiene embargo vigente a favor de la TGR.",
]

clp_m = lambda v: f"CLP {v/1_000_000:,.0f} M".replace(",", ".")
CONTACT = "Ernesto Egert Errázuriz · egerternesto@gmail.com · +56 9 6609 1332   |   GeoCapitals · +56 9 6218 4071"
SRC = "Fuentes: Prospecto Cholqui (Arcos / Leman) · Informe de Ensayo AG2463714 (Andes Analytical Assay) · Circular ENAMI N°27 julio 2026 · Análisis económico del proyecto · Certificados de dominio y avalúos"

# QR al live view verificable
qr_img = qrcode.make(LIVE_URL, box_size=10, border=1)
qr_img.save("/tmp/cholqui_qr.png")
QR = ImageReader("/tmp/cholqui_qr.png")


# ================================================================== SLIDE 01
bg(INK)
cover = ImageReader("src/assets/hero-mining.jpg")
c.drawImage(cover, 0, 0, W, H, mask="auto", preserveAspectRatio=True, anchor="c")
c.setFillColor(Color(0.05, 0.07, 0.09, alpha=0.74))
c.rect(0, 0, W, H, stroke=0, fill=1)
c.setFillColor(Color(0.05, 0.07, 0.09, alpha=0.55))
c.rect(0, 0, 660, H, stroke=0, fill=1)
box(0, H - 8, W, 8, fill=COBALT, stroke=None)
box(72, H - 112, 12, 12, fill=COBALT, stroke=None)
text(94, H - 110, "GEOCAPITALS", "Mono-B", 15, PAPER)
text(72, 470, "COBRE · ORO · PLATA", "Mono-B", 12, COPPER)
text(72, 400, "PROYECTO CHOLQUI", "Sans-B", 52, PAPER)
rule(72, 372, 120, COBALT, 3)
wrap(
    72,
    336,
    "Melipilla, Región Metropolitana · ~5.000 ha · Exploración con muestreo de superficie certificado y faena vecina en producción",
    520,
    "Sans",
    14,
    HexColor("#D5DAE0"),
    20,
)
text(72, 236, "INVESTMENT DECK · CONFIDENCIAL", "Mono", 10, SLATE_L)
text(72, 214, "Titular: Volcania Minerals SpA · Operado en GeoCapitals", "Mono", 10, SLATE_L)
text(72, 192, "Emitido: septiembre 2026", "Mono", 10, SLATE_L)
c.drawImage(QR, W - 208, 120, 112, 112, mask="auto")
text(W - 152, 100, "VERIFICAR EN LÍNEA", "Mono", 8, SLATE_L, "c")
text(W - 152, 86, LIVE_URL.replace("https://", ""), "Mono", 7.4, SLATE_L, "c")
text(72, 96, "No constituye oferta pública de valores. Sin recursos ni reservas certificadas.", "Sans-I", 10, SLATE_L)
c.showPage()

# ================================================================== SLIDE 02
header(
    "01 · Resumen ejecutivo",
    "Un distrito de cobre oxidado con leyes certificadas y salida comercial directa",
    "Cholqui reúne tres condiciones poco frecuentes en exploración temprana chilena: leyes de superficie certificadas por laboratorio, alta razón de cobre soluble y una ruta de venta inmediata a ENAMI a 90 minutos de Santiago.",
)
y = H - 210
for i, (v, l, n) in enumerate(
    [
        ("~5.000 ha", "Superficie controlada", "20 pedimentos + 15 pertenencias (titularidad por conciliar)"),
        ("1,78–16,23 %", "Cu total certificado", "Tres muestras de superficie, Informe AG2463714"),
        ("84–94 %", "Razón Cu soluble / total", "Indicación favorable para lixiviación, sin ensayos metalúrgicos aún"),
        ("CLP 89.571", "Tarifa ENAMI por tms", "A 1,5 % Cu soluble · Circular N°27, julio 2026"),
    ]
):
    metric(72 + i * 292, y, v, l, n, w_=250)
rule(72, y - 96, W - 144, HAIR)
y -= 130
bullets(
    72,
    y,
    [
        "Faena vecina en producción (Mina Las Minitas, ~15.000 t/mes de un tercero) sobre la misma estructura geológica: evidencia de continuidad, no producción propia.",
        "Potencial conceptual del prospecto: 60.750 t de cobre oxidado en el sector La Maza — medición inferida, no recurso ni reserva.",
        "Próxima etapa: ampliar inventario con topografía, canales y sondajes, cerrar metalurgia y sanear títulos antes de comprometer capital de operación.",
    ],
    width=1090,
    size=12,
)
note_box(
    72,
    150,
    W - 144,
    "Este documento no declara recursos ni reservas minerales bajo ningún estándar reconocido y no contiene VAN ni TIR: las fuentes entregadas no los incluyen.",
)
footer(SRC)

# ================================================================== SLIDE 03
header(
    "02 · Activo",
    "Qué es y dónde está",
    "Yacimiento de cobre-oro-plata en la franja Lo Prado – Veta Negra, Cajón de Panamá, comuna de Melipilla.",
)
y = H - 210
rows = [
    ["Ubicación", "Cholqui, Cajón de Panamá, Melipilla, Región Metropolitana, Chile"],
    ["Acceso", "~30 min de la Ruta 78; sin comunidades cercanas según antecedentes del titular"],
    ["Superficie", "~5.000 ha — 20 pedimentos + 15 pertenencias"],
    ["Titular", "Volcania Minerals SpA (dominio a verificar contra acreditación)"],
    ["Sistema de referencia", "UTM PSAD'56 Zona 19H (EPSG 24879), reproyectado a WGS84"],
    ["Cartografía base", "IGM Cholqui E-73 (3345-7100) 1:50.000 · IGM Estero de Cholqui 1:25.000"],
    ["Centroide (WGS84)", "-33,8543 / -71,0430"],
    ["Vecindad", "Rodea a Mina Las Minitas (RG Minerals SpA) y colinda con pertenencias de Yamana Gold"],
]
table(72, y, ["Campo", "Valor"], rows, [260, 828], row_h=30)
note_box(
    72,
    170,
    W - 144,
    "El plano de pertenencias debe digitalizarse y reproyectarse desde PSAD'56 19H a WGS84 para el cruce definitivo con el catastro minero. GeoCapitals mantiene ese cruce automatizado en el live map del proyecto.",
)
footer(SRC)

# ================================================================== SLIDE 04
header(
    "03 · Evidencia geológica",
    "Qué se observó en terreno",
    "29 puntos de observación y muestreo levantados por los geólogos Juan Arcos Vidal Ph.D. y Andrés Leman Vargas, con descripción microscópica de la mineralogía.",
)
y = H - 215
box(72, y - 210, 530, 210, fill=None, stroke=HAIR)
text(92, y - 30, "LITOLOGÍA Y ESTILO", "Mono-B", 8.6, COBALT)
yy = wrap(
    92,
    y - 54,
    "Fm. Veta Negra (ocoítas), Fm. Lo Prado (superior, medio e inferior), Fm. Horqueta, granodioritas-tonalitas y pórfidos dioríticos.",
    490,
    "Sans",
    11,
    INK,
    15,
)
yy = wrap(
    92,
    yy - 22,
    "Vetas cuarzosas y mantos Cu · Au-Cu · Cu-Ag con control estructural, más zonas de alteración hidrotermal argílica y sericítica.",
    490,
    "Sans",
    11,
    INK,
    15,
)
wrap(
    92,
    yy - 22,
    "Mineralogía: calcopirita, tenorita, malaquita, atacamita, azurita, calcosina, bornita, covelina, baritina, argentita, galena, esfalerita y menas grises argentíferas; oro y plata libres bajo microscopio.",
    490,
    "Sans",
    11,
    SLATE,
    15,
)
box(632, y - 210, 576, 210, fill=PAPER_2, stroke=None)
text(652, y - 30, "CINCO CUERPOS MINERALIZADOS DESCRITOS", "Mono-B", 8.6, COBALT)
yy = y - 56
for s in [
    "Las Minitas — mineralización en cuerpos lutíticos y ocoíticos",
    "La Maza — vetas cuarzosas con calcopirita, plata, menas grises y baritina",
    "Las Guías — vetas ocoíticas con calcosina, bornita, plata y trazas de oro",
    "Placeta del Padre – Las Hoyadas — alteración argílica y sericítica en intrusivos",
    "Los Tres Morros — mineralización polimetálica (punto P-20)",
]:
    text(652, yy, "—", "Sans-B", 10.5, COPPER)
    yy = wrap(670, yy, s, 520, "Sans", 10.5, INK, 14) - 14
note_box(
    72,
    170,
    W - 144,
    "Las observaciones mineralógicas de terreno no equivalen a leyes químicas y no permiten inferir tonelaje, continuidad ni ley promedio. No existe sondaje propio.",
)
footer(SRC)

# ================================================================== SLIDE 05
header(
    "04 · Ensayos certificados",
    "Leyes de laboratorio: Informe AG2463714",
    "Tres muestras puntuales de superficie del sector La Maza analizadas por Andes Analytical Assay. Son el único dato de ley certificado del proyecto.",
)
y = H - 210
table(
    72,
    y,
    ["Muestra", "Sector", ">Cu total %", ">Cu soluble %", ">Sol./Total", ">Au g/t", ">Ag ppm"],
    [
        [
            a[0],
            a[1],
            f">{a[2]:.3f}".replace(".", ","),
            f">{a[3]:.3f}".replace(".", ","),
            f">{a[3]/a[2]*100:.0f} %",
            f">{a[4]:.2f}".replace(".", ","),
            f">{a[5]}",
        ]
        for a in ASSAYS
    ],
    [110, 350, 130, 140, 120, 120, 118],
    row_h=30,
)
y -= 140
text(72, y, "CU TOTAL POR MUESTRA (%)", "Mono-B", 8.6, COBALT)
bar_chart(72, y - 16, 520, 130, [(a[0], a[2]) for a in ASSAYS], lambda v: f"{v:.3f} %".replace(".", ","))
text(680, y, "CU SOLUBLE POR MUESTRA (%)", "Mono-B", 8.6, COBALT)
bar_chart(680, y - 16, 528, 130, [(a[0], a[3]) for a in ASSAYS], lambda v: f"{v:.3f} %".replace(".", ","))
note_box(
    72,
    150,
    W - 144,
    "Tres muestras puntuales no permiten estimar ley media de mina, dilución, continuidad, recuperación metalúrgica ni variabilidad. La alta razón de cobre soluble (84–94 %) es una indicación favorable a la ruta de lixiviación, sujeta a ensayos metalúrgicos.",
)
footer(SRC)

# ================================================================== SLIDE 06
header(
    "05 · Puntos de terreno",
    "Observación y muestreo georreferenciado",
    "Selección de los puntos levantados en el prospecto, en coordenadas UTM PSAD'56 Zona 19H. El set completo, reproyectado a WGS84, está publicado en el live map del proyecto.",
)
table(
    72,
    H - 205,
    ["Punto", "Descripción de terreno", ">Este (PSAD'56)", ">Norte"],
    [[p[0], p[1], f">{p[2]:,}".replace(",", "."), f">{p[3]:,}".replace(",", ".")] for p in POINTS],
    [100, 700, 150, 138],
    size=9.2,
    row_h=22,
)
footer(SRC)

# ================================================================== SLIDE 07
header(
    "06 · Contexto distrital",
    "Una faena de terceros ya opera sobre la misma estructura",
    "Mina Las Minitas se encuentra rodeada por las pertenencias del proyecto y explota la continuidad de la misma estructura geológica descrita en el prospecto.",
)
y = H - 215
for i, (v, l, n) in enumerate(
    [
        ("~15.000 t/mes", "Extracción de Las Minitas", "Operación de Sociedad Servicios RG Minerals SpA — no es producción del proyecto"),
        ("~40 ha", "Superficie de la faena vecina", "Rodeada por las pertenencias del proyecto Cholqui"),
        ("Yamana Gold", "Vecino estratégico", "Pertenencias colindantes según el plano del titular"),
        ("~90 min", "Distancia a Santiago", "Acceso a ~30 min de la Ruta 78, sin comunidades cercanas"),
    ]
):
    metric(72 + i * 292, y, v, l, n, w_=250, vsize=26)
y -= 130
box(72, y - 190, W - 144, 190, fill=PAPER_2, stroke=None)
text(96, y - 32, "POR QUÉ IMPORTA", "Mono-B", 8.6, COBALT)
bullets(
    96,
    y - 58,
    [
        "La operación vecina demuestra que la estructura es explotable y comercializable en el distrito, lo que reduce el riesgo geológico conceptual del entorno.",
        "No sustituye la demostración de inventario propio: el proyecto debe probar continuidad, potencia y ley dentro de sus propias pertenencias.",
        "El prospecto recomienda expresamente buscar la continuidad del mineral desde Las Minitas y Cuesta Ancha hacia el interior de la propiedad.",
    ],
    width=1050,
    size=10.8,
    gap=8,
)
note_box(
    72,
    150,
    W - 144,
    "Toda referencia a Mina Las Minitas y a Yamana Gold corresponde a actividad de terceros y se cita únicamente como contexto distrital.",
)
footer(SRC)

# ================================================================== SLIDE 08
header(
    "07 · Escala potencial",
    "Lo que el prospecto permite afirmar — y lo que no",
    "El prospecto calcula un potencial conceptual acotado al sector La Maza. Es una medición inferida por geometría, no una estimación de recursos.",
)
y = H - 215
box(72, y - 200, 560, 200, fill=COBALT_SOFT, stroke=None)
text(96, y - 34, "POTENCIAL GEOLÓGICO CONCEPTUAL", "Mono-B", 8.6, COBALT)
text(96, y - 78, "60.750 t", "Sans-B", 46, COBALT)
wrap(96, y - 108, "de cobre oxidado apto para lixiviación, sector La Maza", 500, "Sans", 12, INK, 16)
wrap(
    96,
    y - 148,
    "Fórmula del prospecto: 300 m (largo) × 50 m (alto) × 1,5 m (potencia) × 1,5 (peso específico) × 1,5 (factor).",
    500,
    "Mono",
    9,
    SLATE,
    13,
)
box(664, y - 200, 544, 200, fill=None, stroke=HAIR)
text(688, y - 34, "TRABAJOS RECOMENDADOS POR EL PROSPECTO", "Mono-B", 8.6, COBALT)
yy = y - 60
for s in [
    "Gamma-espectrometría 1:10.000 en la franja Lo Prado Superior – Veta Negra",
    "Mapeo geológico al Este de la veta La Maza",
    "Zanja en Cuesta Ancha para definir el cuerpo mineralizado",
    "Estudios en el portezuelo de Horcones de Piedra",
    "Continuidad del mineral en Los Tres Morros",
    "Análisis de carbonatos y de vetas negras / lutitas carbonosas por tierras raras",
]:
    text(688, yy, "—", "Sans-B", 10, COPPER)
    yy = wrap(706, yy, s, 486, "Sans", 10, INK, 13) - 11
note_box(
    72,
    150,
    W - 144,
    "Las 60.750 t NO corresponden a recurso ni reserva bajo CH 20235, NI 43-101, JORC ni S-K 1300. El plan económico entregado (166.500 t) excede 2,74 veces esta cifra.",
    tone=HexColor("#F7EEDC"),
    fg=WARN,
    bar=COPPER,
)
footer(SRC)

# ================================================================== SLIDE 09
header(
    "08 · Ruta de monetización",
    "Venta directa a ENAMI, sin planta propia",
    "El producto objetivo es mineral oxidado de cobre vendido a ENAMI bajo la tarifa nacional de óxidos para lixiviación en pilas.",
)
y = H - 215
table(
    72,
    y,
    ["Parámetro tarifario", ">Valor"],
    [
        ["Tarifa base (2,5 % Cu soluble)", ">CLP 171.886 / tms"],
        ["Escala por cada 1 % de Cu", ">CLP 82.315 / tms"],
        ["Tarifa a 1,5 % Cu soluble", ">CLP 89.571 / tms"],
        ["Referencia SX-EW (Cabildo) a 1,5 %", ">CLP 92.738 / tms"],
        ["Alternativa flotación a 1,5 %", ">CLP 117.405 / tms"],
        ["Precio del cobre del parámetro", ">US$ 6,15721 / lb"],
        ["Tipo de cambio tarifario", ">CLP 916,97 / US$"],
        ["Retención tributaria", ">4 %"],
    ],
    [700, 388],
    row_h=25,
)
note_box(
    72,
    172,
    W - 144,
    "La tarifa no es el pago final: se ajusta por consumo de ácido, humedad, impurezas, muestreo, ensayes, diferencias de ley, transporte, recepción efectiva y retención tributaria. Aún no hay agencia ni planta ENAMI receptora identificada, ni carta de aceptación comercial.",
)
footer("Circular ENAMI N°27 — tarifas julio 2026 (óxidos, lixiviación en pilas)")

# ================================================================== SLIDE 10
header(
    "09 · Economía preliminar",
    "Sensibilidad a la ley de cobre soluble",
    "Modelo entregado: 166.500 t en 24 meses, con rampa de 1.500 a 15.000 t/mes. Los escenarios comparten plan minero y costos; sólo cambia la tarifa por ley. El caso efectivamente modelado es 1,5 %.",
)
y = H - 218
table(
    72,
    y,
    ["Escenario", ">Tarifa CLP/tms", ">Ingresos brutos", ">Costos operac.", ">Superávit operac.", ">Equilibrio"],
    [
        [s[0], f">{s[1]:,}".replace(",", "."), f">{clp_m(s[2])}", f">{clp_m(s[3])}", f">{clp_m(s[4])}", f">{s[5]}"]
        for s in SCENARIOS
    ],
    [200, 170, 200, 190, 200, 128],
    row_h=26,
)
y -= 160
text(72, y, "SUPERÁVIT OPERACIONAL NO DESCONTADO POR ESCENARIO", "Mono-B", 8.6, COBALT)
bar_chart(72, y - 18, W - 144, 150, [(s[0][:3], s[4]) for s in SCENARIOS], clp_m, highlight="1,5")
note_box(
    72,
    140,
    W - 144,
    "Escenarios ilustrativos de sensibilidad tarifaria: las leyes de 1,5 % a 3,0 % Cu soluble NO son leyes promedio comprobadas. El modelo no incorpora impuestos, financiamiento, permisos, cierre, seguros ni capital de trabajo, y no contiene VAN ni TIR.",
    tone=HexColor("#F7EEDC"),
    fg=WARN,
    bar=COPPER,
)
footer("Análisis económico Proyecto Cholqui (ley 1,5 %) recalculado a tarifa ENAMI Circular N°27, julio 2026")

# ================================================================== SLIDE 11
header(
    "10 · Caso base",
    "El escenario efectivamente modelado: 1,5 % Cu soluble",
    None,
)
y = H - 190
for i, (v, l, n) in enumerate(
    [
        ("166.500 t", "Plan de producción", "En 24 meses, rampa de 1.500 a 15.000 t/mes"),
        ("CLP 14.914 M", "Ingresos brutos", "A tarifa ENAMI de CLP 89.571/tms"),
        ("CLP 8.911 M", "Costos operacionales", "Modelo entregado, sin depurar ni auditar"),
        ("CLP 6.002 M", "Superávit operacional", "Antes de inversión inicial, impuestos y financiamiento"),
    ]
):
    metric(72 + i * 292, y, v, l, n, w_=250, vsize=27)
y -= 120
for i, (v, l, n) in enumerate(
    [
        ("CLP 242 M", "Inversión inicial", "Mina, camino, asesorías y contingencia"),
        ("Mes 9", "Equilibrio acumulado del modelo", "Único payback documentado en la fuente"),
        ("2.341 t/mes", "Punto de equilibrio", "A la tarifa vigente de julio 2026"),
        ("CLP 5.760 M", "Resultado tras inversión", "Superávit operacional menos inversión inicial"),
    ]
):
    metric(72 + i * 292, y, v, l, n, w_=250, vsize=27, color=COPPER if i == 1 else COBALT)
y -= 120
box(72, y - 152, W - 144, 152, fill=PAPER_2, stroke=None)
text(96, y - 30, "CONDICIÓN DE VALIDEZ", "Mono-B", 8.6, COBALT)
bullets(
    96,
    y - 56,
    [
        "El caso base supone disponer de 166.500 t de mineral con 1,5 % de cobre soluble: hoy ese inventario no está demostrado.",
        "Antes de comprometer capital de operación es necesario ampliar inventario, cerrar metalurgia y obtener aceptación comercial de ENAMI.",
    ],
    width=1050,
    size=10.8,
    gap=8,
)
footer(SRC)

# ================================================================== SLIDE 12
header(
    "11 · Brechas materiales",
    "Qué falta validar antes de comprometer capital",
    "Revisión técnica, legal y financiera de julio de 2026 sobre los antecedentes entregados.",
)
bullets(72, H - 205, GAPS, width=1100, size=11.2, gap=21, marker=COPPER)
note_box(
    72,
    150,
    W - 144,
    "Estas brechas no invalidan el activo: definen la agenda de de-risking de los próximos 90 días y el uso de los fondos de la ronda.",
)
footer("Revisión de antecedentes del proyecto, julio 2026")

# ================================================================== SLIDE 13
header(
    "12 · De-risking",
    "Plan de trabajo 0–90 días",
    "Secuencia diseñada para convertir evidencia puntual en inventario demostrado y contrato comercial en firme.",
)
y = H - 205
for when, what in MILESTONES:
    box(72, y - 54, 150, 54, fill=COBALT_SOFT, stroke=None)
    text(88, y - 34, when, "Mono-B", 12, COBALT)
    box(222, y - 54, W - 294, 54, fill=None, stroke=HAIR)
    wrap(244, y - 26, what, 900, "Sans", 11.5, INK, 15)
    y -= 66
note_box(
    72,
    150,
    W - 144,
    "Hitos condicionantes para cualquier desembolso posterior: conciliación de títulos, inventario demostrado para al menos 12 meses de operación y aceptación comercial de ENAMI.",
)
footer(SRC)

# ================================================================== SLIDE 14
header(
    "13 · Estructura de inversión",
    "Qué obtiene el inversionista",
    "Términos referenciales para conversación; no constituyen oferta pública de valores.",
)
y = H - 205
table(
    72,
    y,
    ["Término", ">Valor referencial"],
    [
        ["Valorización del activo", ">US$ 4.000.000 – US$ 6.000.000"],
        ["Método de valorización", ">Comparables + flujo a tarifa ENAMI 1,5–2,5 % Cu soluble"],
        ["Tamaño de la ronda", ">US$ 1.000.000"],
        ["Instrumento", ">Equity SpA · 15 % ofrecido"],
        ["Ticket mínimo", ">US$ 25.000"],
        ["Horizonte", ">4 años"],
    ],
    [430, 300],
    row_h=25,
)
text(832, y - 14, "USO DE FONDOS", "Mono-B", 8.6, COBALT)
yy = y - 40
for label, pct in USE_OF_FUNDS:
    text(832, yy, f"{pct} %", "Mono-B", 11, COBALT)
    box(884, yy - 3, 2.4 * pct, 12, fill=COBALT, stroke=None)
    wrap(832, yy - 18, label, 376, "Sans", 9.6, SLATE, 12)
    yy -= 46
note_box(
    72,
    150,
    W - 144,
    "Alternativa evaluada en los antecedentes: línea senior con garantías por hasta CLP 450 M en dos tramos (CLP 250 M y hasta CLP 200 M), con el segundo tramo condicionado a aceptación ENAMI, conciliación de títulos e inventario demostrado.",
)
footer(SRC)

# ================================================================== SLIDE 15
header(
    "14 · Garantías y flujo secundario",
    "Respaldo documentado del grupo controlador",
    "Avalúos fiscales certificados: no equivalen a tasación comercial ni a valor de realización.",
)
y = H - 200
table(
    72,
    y,
    ["Activo en garantía", "Titular", ">Avalúo fiscal CLP", "Estado"],
    [[g[0], g[1], f">{g[2]}", g[3]] for g in GUARANTEES],
    [370, 250, 200, 268],
    row_h=26,
)
y -= 210
metric(72, y, "CLP 437 M", "Total documentado", "Suma de avalúos fiscales certificados", w_=280, vsize=26)
metric(432, y, "CLP 313 M", "Libre de embargo", "Excluye el Lote 2 (Rol 16-33) con embargo TGR", w_=280, vsize=26)
metric(792, y, "CLP 130 M/mes", "Contrato de áridos", "20.000 m³/mes a CLP 6.500/m³ + IVA, desde febrero 2026", w_=300, vsize=26, color=COPPER)
note_box(
    72,
    140,
    W - 144,
    "El Anexo N°1 del contrato de áridos deja sin efecto la obligación de pago del volumen mínimo si el cliente no retira el material: no es take-or-pay ni flujo firme para cubrir deuda.",
    tone=HexColor("#F7EEDC"),
    fg=WARN,
    bar=COPPER,
)
footer("Certificados de dominio, avalúos y gravámenes · Contrato de suministro de rocas y Anexo N°1")

# ================================================================== SLIDE 16
header("15 · Riesgos", "Advertencias obligatorias", None)
bullets(72, H - 200, CAVEATS, width=1100, size=11.4, gap=24, marker=COPPER)
note_box(
    72,
    130,
    W - 144,
    "Documento informativo preparado por GeoCapitals sobre antecedentes entregados por el titular. No es una recomendación de inversión, una opinión legal, una auditoría financiera ni un informe técnico de recursos o reservas.",
)
footer(SRC)

# ================================================================== SLIDE 17
bg(INK)
box(0, H - 8, W, 8, fill=COBALT, stroke=None)
box(72, H - 116, 12, 12, fill=COBALT, stroke=None)
text(94, H - 114, "GEOCAPITALS", "Mono-B", 15, PAPER)
text(72, 470, "PROYECTO CHOLQUI", "Sans-B", 40, PAPER)
rule(72, 442, 110, COBALT, 3)
wrap(
    72,
    404,
    "Expediente completo, mapa de pertenencias, puntos de terreno, ensayos y escenarios verificables en línea:",
    620,
    "Sans",
    13,
    HexColor("#C9D0D7"),
    19,
)
text(72, 346, LIVE_URL, "Mono-B", 15, COBALT_SOFT)
text(72, 274, "CONTACTO", "Mono-B", 9, SLATE_L)
wrap(72, 248, CONTACT, 700, "Sans", 12, PAPER, 20)
c.drawImage(QR, W - 260, 250, 150, 150, mask="auto")
text(W - 185, 230, "VERIFICACIÓN GEOCAPITALS", "Mono", 8, SLATE_L, "c")
rule(72, 150, W - 144, HAIR_DARK)
wrap(
    72,
    126,
    "Documento confidencial. No constituye oferta pública de valores ni recomendación de inversión. Sin recursos ni reservas certificadas bajo CH 20235, NI 43-101, JORC o S-K 1300.",
    W - 144,
    "Sans",
    9.6,
    SLATE_L,
    13,
)
c.showPage()

c.save()
print("deck ok ->", OUT)
