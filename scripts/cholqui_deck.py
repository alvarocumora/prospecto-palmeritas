"""PROYECTO CHOLQUI — Investment Deck (institucional, 16:9).

Regla de contenido: sólo se usan datos contenidos en las fuentes entregadas
(Prospecto "Cholqui" — Juan Arcos Vidal Ph.D., 20-01-2025; planillas
Analisis_economico_Proyecto_Cholqui 1,5 / 2 / 2,5 / 3 %; ficha interna
docs/proyectos/cholqui.md). Cualquier dato no disponible aparece como
placeholder editable [ ]. No se declaran recursos ni reservas.
"""

import json

from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas

W, H = 1280, 720
INK = HexColor("#12161A")
GRAPHITE = HexColor("#1E252B")
SLATE = HexColor("#6E7A83")
SLATE_L = HexColor("#9AA4AC")
COPPER = HexColor("#C0703A")
SAND = HexColor("#D8CBB6")
PAPER = HexColor("#F5F2EC")
PAPER_2 = HexColor("#EDE8DE")
GREEN = HexColor("#2E5B4E")
LINE = HexColor("#D6CEC0")

for name, f in [
    ("Sans", "InstrumentSans-Regular"),
    ("Sans-B", "InstrumentSans-Bold"),
    ("Sans-I", "InstrumentSans-Italic"),
    ("Mono", "GeistMono-Regular"),
    ("Mono-B", "GeistMono-Bold"),
    ("Display", "BigShoulders-Bold"),
]:
    pdfmetrics.registerFont(TTFont(name, f"/tmp/fonts/{f}.ttf"))

ECON = json.load(open("/tmp/econ.json"))
ORDER = ["1.5", "2.0", "2.5", "3.0"]
CONTACT = "Ernesto Egert Errázuriz · egerternesto@gmail.com · +56 9 6609 1332  |  GeoCapitals · +56 9 6218 4071"

c = rl_canvas.Canvas("/mnt/documents/Proyecto_Cholqui_Investment_Deck.pdf", pagesize=(W, H))
PAGE = {"n": 0}


# ---------------------------------------------------------------- primitivas
def bg(color=PAPER):
    c.setFillColor(color)
    c.rect(0, 0, W, H, stroke=0, fill=1)


def text(x, y, s, font="Sans", size=12, color=INK, align="l", leading=None):
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "c":
        c.drawCentredString(x, y, s)
    elif align == "r":
        c.drawRightString(x, y, s)
    else:
        c.drawString(x, y, s)


def wrap(x, y, s, width, font="Sans", size=12, color=INK, leading=None):
    leading = leading or size * 1.45
    words, line, out = s.split(), "", []
    for w_ in words:
        t = (line + " " + w_).strip()
        if pdfmetrics.stringWidth(t, font, size) > width and line:
            out.append(line)
            line = w_
        else:
            line = t
    out.append(line)
    for i, ln in enumerate(out):
        text(x, y - i * leading, ln, font, size, color)
    return y - (len(out) - 1) * leading


def rule(x, y, w_, color=LINE, lw=1):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x, y, x + w_, y)


def box(x, y, w_, h_, fill=None, stroke=LINE, lw=1, radius=0):
    if fill:
        c.setFillColor(fill)
    c.setStrokeColor(stroke) if stroke else None
    c.setLineWidth(lw)
    if radius:
        c.roundRect(x, y, w_, h_, radius, stroke=1 if stroke else 0, fill=1 if fill else 0)
    else:
        c.rect(x, y, w_, h_, stroke=1 if stroke else 0, fill=1 if fill else 0)


def header(kicker, title, dark=False):
    fg = PAPER if dark else INK
    sub = SAND if dark else COPPER
    text(72, H - 74, kicker.upper(), "Mono", 10.5, sub)
    text(72, H - 118, title.upper(), "Sans-B", 32, fg)
    rule(72, H - 138, 96, sub, 2.4)


def takeaway(s, dark=False, width=1000):
    wrap(72, H - 172, s, width, "Sans-I", 14.5, SAND if dark else SLATE)


def footer(source, dark=False):
    PAGE["n"] += 1
    fg = HexColor("#5A646C") if not dark else HexColor("#7C878F")
    rule(72, 58, W - 144, LINE if not dark else HexColor("#2C343B"))
    text(72, 40, source, "Mono", 8, fg)
    text(W - 72, 40, f"PROYECTO CHOLQUI · {PAGE['n']:02d}", "Mono", 8, fg, align="r")
    c.showPage()


def metric(x, y, value, label, note=None, dark=False, vsize=46, w_=280):
    fg = PAPER if dark else INK
    text(x, y, value, "Display", vsize, COPPER if not dark else SAND)
    text(x, y - 26, label.upper(), "Mono", 9.5, fg if not dark else PAPER)
    if note:
        wrap(x, y - 46, note, w_, "Sans", 10.5, SLATE if not dark else SLATE_L, 14)


def disclaimer(x, y, s, w_=1136, dark=False):
    box(x, y - 6, w_, 34, fill=PAPER_2 if not dark else HexColor("#1A2126"), stroke=None)
    wrap(x + 14, y + 14, s, w_ - 28, "Sans", 9.5, SLATE if not dark else SLATE_L, 12)


# ------------------------------------------------------------------ slide 1
bg(INK)
img = ImageReader("/mnt/documents/.lovable/cholqui_cover.jpg")
c.drawImage(img, 0, 0, W, H, mask="auto")
c.setFillColor(Color(0.03, 0.05, 0.06, alpha=0.72))
c.rect(0, 0, W, H, stroke=0, fill=1)
c.setFillColor(Color(0.03, 0.05, 0.06, alpha=0.55))
c.rect(0, 0, 620, H, stroke=0, fill=1)
text(72, 470, "COPPER · GOLD · SILVER", "Mono", 12, SAND)
text(72, 400, "PROYECTO", "Sans-B", 62, PAPER)
text(72, 336, "CHOLQUI", "Sans-B", 62, COPPER)
rule(72, 306, 120, SAND, 2.4)
wrap(72, 272, "Exploration & Development Opportunity — Melipilla, Región Metropolitana, Chile.",
     520, "Sans", 15, PAPER, 22)
wrap(72, 212, "“Strategically located polymetallic mining opportunity in Chile's central mining district.”",
     520, "Sans-I", 14, SAND, 20)
text(72, 138, "PRESENTADO A GEOCAPITALS", "Mono", 9.5, SLATE_L)
text(72, 120, "Confidencial · Documento preliminar de discusión · 2026", "Mono", 9.5, SLATE_L)
for i, (v, l) in enumerate([("5.000 ha", "Propiedad minera"), ("20", "Pedimentos"),
                            ("15", "Pertenencias"), ("Cu·Au·Ag", "Polimetálico")]):
    x = 760 + (i % 2) * 240
    y = 400 - (i // 2) * 110
    text(x, y, v, "Sans-B", 26, PAPER)
    text(x, y - 20, l.upper(), "Mono", 9, SAND)
footer("Fuentes: Prospecto “Cholqui” (J. Arcos Vidal, Ph.D., 2025); antecedentes de propiedad minera del titular. Imagen referencial de cordillera de la costa, Chile central — no corresponde al sitio.", dark=True)

# ------------------------------------------------------------------ slide 2
bg()
header("02 · Investment highlights", "Qué se está adquiriendo hoy")
takeaway("Posición territorial consolidada de escala distrital, con evidencia geológica de superficie y actividad minera activa inmediatamente adyacente.")
data = [
    ("5.000", "hectáreas de propiedad", "20 pedimentos + 15 pertenencias en Cholqui / Cajón de Panamá."),
    ("35", "concesiones agrupadas", "Titular declarado: Volcania Minerals SpA (dominio por validar)."),
    ("Cu·Au·Ag", "potencial polimetálico", "Cpy, tenorita, malaquita, atacamita; Au y Ag en tamaños micrométricos bajo microscopio."),
    ("29", "puntos de observación", "Tabla 1 del prospecto: vetas, mantos y zonas de alteración."),
    ("~30 min", "de la Ruta 78", "Zona central de Chile, sin comunidades cercanas según antecedentes."),
    ("Adyacente", "a faena en producción", "Mina Las Minitas: ~15.000 t/mes en ~40 ha (operador vecino)."),
]
for i, (v, l, n) in enumerate(data):
    x = 72 + (i % 3) * 384
    y = 470 - (i // 3) * 168
    box(x, y - 96, 352, 148, fill=PAPER_2, stroke=LINE, radius=3)
    metric(x + 24, y, v, l, n, vsize=40, w_= 306)
disclaimer(72, 96, "Activo en etapa temprana con evidencia geológica y actividad minera existente en el área inmediata. No existe estimación de recursos ni reservas minerales bajo estándar reconocido (NI 43-101 / JORC). Todas las cifras corresponden a antecedentes declarados y documentación aportada por el titular.")
footer("Fuentes: Prospecto “Cholqui”, Tabla 1 y Tabla 2 (J. Arcos Vidal, 2025); ficha de proyecto del titular.")

# ------------------------------------------------------------------ slide 3
bg(INK)
header("03 · Investment thesis", "Why Cholqui?", dark=True)
takeaway("La oportunidad no es una mina en operación: es capturar valor antes de la definición geológica del activo.", dark=True)
pillars = [
    ("01", "LOCATION", "Melipilla, Región Metropolitana. Acceso a ~30 min de la Ruta 78, en el corazón logístico y de servicios mineros de Chile central."),
    ("02", "GEOLOGY", "Fm. Veta Negra, Lo Prado y Horqueta, con intrusivos granodioríticos y zonas de alteración argílica-sericítica documentadas."),
    ("03", "NEIGHBOURING ACTIVITY", "Mina Las Minitas operando de forma inmediata al norte del bloque; contexto geológico y operacional relevante."),
    ("04", "EXPLORATION UPSIDE", "5.000 ha bajo control versus una huella minera vecina de ~40 ha: múltiples blancos aún no perforados."),
]
for i, (n, t, d) in enumerate(pillars):
    x = 72 + i * 290
    text(x, 450, n, "Display", 48, COPPER)
    text(x, 412, t, "Sans-B", 13.5, PAPER)
    rule(x, 400, 40, SAND, 1.6)
    wrap(x, 378, d, 250, "Sans", 11, SLATE_L, 15.5)
chain = ["EVIDENCIA", "EXPLORACIÓN", "DEFINICIÓN DE RECURSOS", "DESARROLLO", "PRODUCCIÓN POTENCIAL"]
bx, bw = 72, (W - 144 - 4 * 16) / 5
for i, s in enumerate(chain):
    x = bx + i * (bw + 16)
    fill = HexColor("#242C33") if i > 0 else COPPER
    box(x, 210, bw, 44, fill=fill, stroke=None, radius=2)
    text(x + bw / 2, 226, s, "Mono", 9, PAPER if i else INK, align="c")
    if i < 4:
        text(x + bw + 8, 226, "›", "Sans-B", 14, SAND, align="c")
text(72, 178, "HOY", "Mono", 9, COPPER)
text(W - 72, 178, "RE-RATING DEL ACTIVO", "Mono", 9, SAND, align="r")
disclaimer(72, 96, "“GeoCapitals no invierte en la mina terminada: invierte antes de un potencial re-rating geológico.” La secuencia mostrada es la ruta técnica estándar de creación de valor y no implica que sus etapas estén aseguradas.", dark=True)
footer("Fuentes: Prospecto “Cholqui”, secciones Geología Regional, Mineralización y Trabajos de Exploración (2025).", dark=True)

# ------------------------------------------------------------------ slide 4
bg()
header("04 · Strategic location", "Ubicación estratégica")
takeaway("Chile central: acceso a servicios mineros, infraestructura, profesionales técnicos y logística consolidada.", width=620)
box(72, 150, 620, 380, fill=PAPER_2, stroke=LINE, radius=3)
# esquema de localización (referencial, no a escala)
c.setStrokeColor(SAND)
c.setLineWidth(1.2)
c.setDash(4, 4)
c.line(140, 200, 140, 496)
c.setDash()
text(140, 506, "CORDILLERA DE LA COSTA", "Mono", 8, SLATE, align="c")
c.setStrokeColor(GRAPHITE)
c.setLineWidth(3)
c.line(180, 456, 620, 390)
text(200, 466, "RUTA 78 · SANTIAGO — SAN ANTONIO", "Mono", 9, GRAPHITE)
c.setFillColor(GRAPHITE)
c.circle(600, 392, 6, stroke=0, fill=1)
text(614, 386, "SANTIAGO / R.M.", "Mono", 9, GRAPHITE)
c.setFillColor(SLATE)
c.circle(300, 436, 5, stroke=0, fill=1)
text(268, 416, "MELIPILLA", "Mono", 9, SLATE)
box(230, 240, 260, 150, fill=HexColor("#DCE8E2"), stroke=GREEN, radius=3)
text(360, 330, "PROYECTO CHOLQUI", "Sans-B", 14, GREEN, align="c")
text(360, 310, "5.000 ha · Cajón de Panamá", "Mono", 9, GREEN, align="c")
c.setFillColor(COPPER)
c.circle(470, 372, 7, stroke=0, fill=1)
text(486, 366, "LAS MINITAS", "Mono", 9, COPPER)
c.setStrokeColor(SLATE_L)
c.setLineWidth(1)
c.setDash(3, 3)
c.line(360, 390, 470, 372)
c.setDash()
text(360, 210, "Esquema referencial de posición relativa — no a escala cartográfica", "Sans-I", 9.5, SLATE, align="c")
facts = [
    ("Región", "Metropolitana de Santiago"),
    ("Comuna", "Melipilla — Cholqui / Cajón de Panamá"),
    ("Carta IGM", "Cholqui E-73 (3345-7100), 1:50.000, PSAD'56"),
    ("Datum de los planos", "PSAD'56 · Zona 19H"),
    ("Accesibilidad", "~30 minutos de la Ruta 78 (dato declarado)"),
    ("Entorno social", "Sin comunidades cercanas según antecedentes actuales"),
]
y = 500
for k, v in facts:
    text(730, y, k.upper(), "Mono", 8.5, COPPER)
    wrap(730, y - 16, v, 460, "Sans", 12.5, INK, 16)
    rule(730, y - 34, 478)
    y -= 62
disclaimer(72, 96, "Distancias y tiempos corresponden a antecedentes declarados por el titular y no han sido verificados de forma independiente. La ubicación de Mina Las Minitas se referencia al punto de acceso registrado en Tabla 1 (N 6.254.770 / E 312.833, PSAD'56 19H).")
footer("Fuentes: Prospecto “Cholqui” (2025), Tabla 1 y carta IGM Cholqui E-73; antecedentes del titular.")

# ------------------------------------------------------------------ slide 5
bg()
header("05 · Mining property", "Escala de la propiedad")
takeaway("Posición territorial de 5.000 ha frente a una huella minera vecina de ~40 hectáreas.")
# comparación de escala (área proporcional)
box(72, 200, 560, 330, fill=PAPER_2, stroke=LINE, radius=3)
side = 250
c.setFillColor(HexColor("#DCE8E2"))
c.setStrokeColor(GREEN)
c.setLineWidth(1.5)
c.rect(120, 235, side, side, stroke=1, fill=1)
small = side * (40 / 5000) ** 0.5
c.setFillColor(COPPER)
c.rect(120 + 8, 235 + 8, small, small, stroke=0, fill=1)
text(120, 500, "CHOLQUI · 5.000 ha", "Sans-B", 13, GREEN)
text(128 + small + 10, 240, "LAS MINITAS ~40 ha", "Mono", 9, COPPER)
text(120, 214, "Comparación de superficie a escala real de área (5.000 ha vs ~40 ha)", "Sans", 9.5, SLATE)
rows = [
    ("Pedimentos mineros", "20", "En trámite / constitución"),
    ("Pertenencias mineras", "15", "Concesiones de explotación"),
    ("Superficie total declarada", "~5.000 ha", "Bloque continuo en torno a la faena vecina"),
    ("Titular declarado", "Volcania Minerals SpA", "Acreditación de dominio: por validar"),
    ("Vecinos relevantes", "Las Minitas · Yamana Gold", "Según plano de pertenencias del proyecto"),
]
y = 505
for k, v, n in rows:
    text(680, y, k.upper(), "Mono", 8.5, COPPER)
    text(680, y - 20, v, "Sans-B", 17, INK)
    text(680, y - 38, n, "Sans", 10.5, SLATE)
    rule(680, y - 52, 528)
    y -= 74
# leyenda
for i, (col, lab) in enumerate([(GREEN, "Proyecto Cholqui"), (COPPER, "Operación vecina (Las Minitas)"),
                                (SLATE_L, "Otros titulares / terceros")]):
    x = 72 + i * 190
    c.setFillColor(col)
    c.rect(x, 168, 14, 14, stroke=0, fill=1)
    text(x + 22, 172, lab, "Sans", 10.5, INK)
disclaimer(72, 96, "El plano de pertenencias original debe digitalizarse y reproyectarse de PSAD'56 19H a WGS84 para su publicación en el mapa del data room. Las superficies son declaradas por el titular y quedan sujetas a verificación en el catastro minero (Sernageomin / Conservador de Minas).")
footer("Fuentes: plano de pertenencias del proyecto; ficha de propiedad minera del titular; Prospecto “Cholqui” (2025).")

# ------------------------------------------------------------------ slide 6
bg()
header("06 · Geological evidence", "Evidencia geológica temprana")
takeaway("La evidencia se presenta separada en tres niveles: dato confirmado, interpretación geológica e hipótesis de exploración.")
cols = [
    ("DATO CONFIRMADO", GREEN, [
        "29 puntos de observación y muestreo georreferenciados con GPS (PSAD'56 19H).",
        "Mineralogía bajo microscopio: calcopirita, tenorita, malaquita, atacamita, brochantita, azurita, pirita.",
        "Oro y plata identificados en tamaños micrométricos en muestras P-2 y P-3.",
        "Vetas y mantos medidos con rumbo, manteo y potencia (0,6 – 2,0 m).",
    ]),
    ("INTERPRETACIÓN", COPPER, [
        "Cinco cuerpos mineralizados definidos: Las Minitas, La Maza, Las Guías, Placeta del Padre–Las Hoyadas y Los Tres Morros.",
        "Control estructural NNW–NNE con vetas cuarzosas y mantos en secuencias volcano-sedimentarias.",
        "Alteración argílica y sericítica asociada a intrusivos granodioríticos.",
    ]),
    ("HIPÓTESIS DE EXPLORACIÓN", SLATE, [
        "Posible continuidad estructural desde Las Minitas hacia el sur y desde Cuesta Ancha hacia norte y sur.",
        "Potencial de cuerpos de tonelaje/ley de Cu, Au o Ag en el lado este del Cajón de Panamá.",
        "Requiere gamma-espectrometría 1:10.000, mapeo, zanjas y posterior sondaje para ser demostrada.",
    ]),
]
for i, (t, col, items) in enumerate(cols):
    x = 72 + i * 384
    box(x, 190, 352, 330, fill=PAPER_2 if i != 1 else HexColor("#F2E7DC"), stroke=LINE, radius=3)
    text(x + 22, 490, t, "Mono", 10, col)
    rule(x + 22, 478, 40, col, 2)
    y = 452
    for it in items:
        c.setFillColor(col)
        c.circle(x + 26, y + 4, 2.6, stroke=0, fill=1)
        y = wrap(x + 38, y, it, 296, "Sans", 11, INK, 15.5) - 22
text(72, 160, "AUTORES DE LOS ANTECEDENTES GEOLÓGICOS", "Mono", 8.5, COPPER)
text(72, 140, "Juan Arcos Vidal, Geólogo Ph.D. — Prospecto “Cholqui”, Valparaíso, 20 de enero de 2025   ·   Andrés Leman Vargas, Geólogo — observaciones e informes del proyecto", "Sans", 11.5, INK)
disclaimer(72, 90, "Ninguna de las observaciones anteriores constituye una estimación de recursos o reservas minerales. La continuidad, ley y tonelaje permanecen por demostrar mediante exploración sistemática.")
footer("Fuentes: Prospecto “Cholqui” — Geología Regional, Mineralización, Conclusiones y Recomendaciones (J. Arcos Vidal, 2025).")

# ------------------------------------------------------------------ slide 7
bg()
header("07 · Sampling & assays", "Muestreo y análisis")
takeaway("El muestreo inicial confirma la presencia de mineralización de Cu–Au–Ag en superficie y justifica exploración sistemática adicional.", width=690)
c.drawImage(ImageReader("/tmp/ch_map.png"), 62, 140, 520, 400, mask="auto")
text(322, 128, "Puntos de observación y muestreo · Tabla 1 (PSAD'56 19H)", "Sans", 9.5, SLATE, align="c")
hdr = ["MUESTRA", "SECTOR", "MINERALOGÍA OBSERVADA (MICROSCOPÍA)"]
rowsm = [
    ("P-1", "Manto La Maza", "Tenorita, malaquita, atacamita; trazas Py, Cpy. Ag 200 micras (1)."),
    ("P-2", "Veta La Maza Sur", "Cpy, tenorita, malaquita, atacamita. Au 50 micras (1); Ag 50 micras (1)."),
    ("P-3", "Veta La Maza Portezuelo", "Cpy, tenorita, malaquita, atacamita. Au 25 micras (3), 50 micras (2); Ag 50 micras (2), 75 micras (1)."),
    ("P-5", "Cascada El Infiernillo", "Tenorita, Cpy; trazas de pirita."),
    ("P-6", "Cuesta Ancha", "Cpy, tenorita; trazas de pirita y malaquita."),
    ("P-20", "Los Tres Morros", "Mineralización polimetálica en pique, veta az. 295º/90º, pot. 2 m."),
]
x0, y = 620, 512
text(x0, y, hdr[0], "Mono", 8.5, COPPER)
text(x0 + 80, y, hdr[1], "Mono", 8.5, COPPER)
text(x0 + 250, y, hdr[2], "Mono", 8.5, COPPER)
rule(x0, y - 10, 588, COPPER, 1.2)
y -= 34
for m, s, d in rowsm:
    text(x0, y, m, "Mono-B", 11, GREEN)
    wrap(x0 + 80, y, s, 160, "Sans", 10.5, INK, 13)
    yy = wrap(x0 + 250, y, d, 338, "Sans", 10.5, SLATE, 13)
    rule(x0, yy - 12, 588)
    y = yy - 32
disclaimer(620, 150, "Cuatro puntos fueron enviados a laboratorio certificado; los certificados completos y las leyes químicas se incluyen en el Anexo A4. Las observaciones de Tabla 2 son mineralógicas (microscopía) y no equivalen a leyes de mineral.", w_=588)
disclaimer(72, 90, "Resultados de muestreo de superficie puntual. No son representativos de un cuerpo mineralizado ni permiten inferir leyes promedio, tonelaje o continuidad.")
footer("Fuentes: Prospecto “Cholqui”, Tabla 1 (29 puntos) y Tabla 2 (desglose mineralógico bajo microscopio), J. Arcos Vidal, 2025.")

# ------------------------------------------------------------------ slide 8
bg(INK)
header("08 · Neighbouring activity", "Mining activity next door", dark=True)
takeaway("Una faena en producción opera de forma inmediata al bloque, sobre el mismo dominio geológico documentado.", dark=True)
box(72, 230, 540, 290, fill=HexColor("#1A2126"), stroke=HexColor("#2C343B"), radius=3)
text(102, 470, "MINA LAS MINITAS", "Sans-B", 20, COPPER)
text(102, 446, "Operador vecino — faena activa", "Mono", 9.5, SLATE_L)
for i, (v, l) in enumerate([("~15.000 t", "producción mensual declarada"),
                            ("~40 ha", "huella operacional"),
                            ("Lutitas y ocoítas", "roca hospedante de la mineralización")]):
    y = 396 - i * 56
    text(102, y, v, "Sans-B", 20, PAPER)
    text(102, y - 18, l.upper(), "Mono", 8.5, SLATE_L)
box(660, 230, 548, 290, fill=HexColor("#1A2126"), stroke=HexColor("#2C343B"), radius=3)
text(690, 470, "PROYECTO CHOLQUI", "Sans-B", 20, SAND)
text(690, 446, "Etapa de exploración temprana", "Mono", 9.5, SLATE_L)
for i, (v, l) in enumerate([("5.000 ha", "posición territorial bajo control"),
                            ("125×", "superficie respecto de la huella vecina"),
                            ("0 sondajes", "sin perforación propia a la fecha")]):
    y = 396 - i * 56
    text(690, y, v, "Sans-B", 20, PAPER)
    text(690, y - 18, l.upper(), "Mono", 8.5, SLATE_L)
disclaimer(72, 130, "La producción del vecino no demuestra recursos minerales equivalentes dentro de Cholqui: constituye contexto geológico y operacional que respalda continuar la exploración. La continuidad dentro del bloque debe demostrarse mediante trabajo sistemático.", dark=True)
footer("Fuentes: antecedentes de la operación vecina aportados por el titular; Prospecto “Cholqui” (2025), Conclusiones.", dark=True)

# ------------------------------------------------------------------ slide 9
bg()
header("09 · Exploration upside", "De indicios geológicos a activo definido")
takeaway("La oportunidad central es convertir indicaciones geológicas en un activo mineral definido y financiable.")
groups = [
    ("KNOWN", GREEN, ["Mineralización de superficie", "Mineralogía Cu–Au–Ag confirmada",
                      "29 puntos de observación", "Minería activa adyacente"]),
    ("TO DEFINE", COPPER, ["Continuidad geológica", "Estructuras mineralizadas",
                           "Extensión en profundidad", "Continuidad de leyes", "Potencial de tonelaje"]),
    ("VALUE CREATION", GRAPHITE, ["Gamma-espectrometría 1:10.000", "Mapeo y zanjas (Cuesta Ancha)",
                                  "Campaña de sondaje", "Modelo geológico 3D",
                                  "Estimación de recursos", "Estudios metalúrgicos"]),
]
for i, (t, col, items) in enumerate(groups):
    x = 72 + i * 384
    box(x, 176, 352, 340, fill=PAPER_2, stroke=col, radius=3, lw=1.4)
    box(x, 480, 352, 36, fill=col, stroke=None, radius=3)
    text(x + 176, 492, t, "Mono", 10.5, PAPER, align="c")
    y = 448
    for it in items:
        text(x + 24, y, "—", "Mono", 10, col)
        y = wrap(x + 46, y, it, 284, "Sans", 12, INK, 15) - 24
    if i < 2:
        text(x + 368, 340, "›", "Sans-B", 26, COPPER, align="c")
disclaimer(72, 96, "Programa técnico basado en las recomendaciones y trabajos de exploración propuestos en el prospecto geológico. Los resultados de cualquiera de estas etapas son inciertos y no garantizan la definición de recursos.")
footer("Fuentes: Prospecto “Cholqui” — Recomendaciones y Trabajos de Exploración (J. Arcos Vidal, 2025).")

# ----------------------------------------------------------------- slide 10
bg()
header("10 · Preliminary economics", "Sensibilidad económica preliminar")
takeaway("Escenarios ilustrativos construidos sobre un plan minero de 25 meses y tarifa ENAMI: la variable crítica es la ley de cobre.", width=690)
c.drawImage(ImageReader("/tmp/ch_sens.png"), 62, 240, 700, 296, mask="auto")
x0 = 790
text(x0, 590, "ESCENARIO", "Mono", 8.5, COPPER)
text(x0 + 130, 590, "TARIFA CLP/t", "Mono", 8.5, COPPER)
text(x0 + 265, 590, "INGRESOS", "Mono", 8.5, COPPER)
text(x0 + 375, 590, "MARGEN", "Mono", 8.5, COPPER)
rule(x0, 580, 418, COPPER, 1.2)
y = 556
for k in ORDER:
    e = ECON[k]
    text(x0, y, f"{k} % Cu", "Sans-B", 13, INK)
    text(x0 + 130, y, f"{int(e['tarifa']):,}".replace(",", "."), "Mono", 11.5, SLATE)
    text(x0 + 265, y, f"US$ {e['ing_usd']/1e6:.1f} M", "Mono", 11.5, SLATE)
    text(x0 + 375, y, f"US$ {e['uti_usd']/1e6:.1f} M", "Mono-B", 11.5, COPPER)
    rule(x0, y - 12, 418)
    y -= 42
text(x0, 370, "SUPUESTOS COMUNES A LOS CUATRO ESCENARIOS", "Mono", 8.5, COPPER)
wrap(x0, 350, "166.500 t de mineral en 25 meses (rampa 1.500 → 15.000 t/mes) · REM 1,5 · tarifa ENAMI nov-2025 · tipo de cambio 940 CLP/US$ · inversión inicial CLP 243.984.290 (~US$ 260 mil) incluyendo camino de 8,5 km.",
     418, "Sans", 11, SLATE, 15)
disclaimer(72, 96, "Escenarios ilustrativos — sujetos a validación geológica, metalúrgica, de ingeniería y económica. Las leyes de 1,5 % a 3,0 % Cu son hipótesis de sensibilidad y NO corresponden a leyes promedio comprobadas ni a recursos minerales. Las planillas no contienen VAN ni TIR: el margen mostrado es utilidad acumulada no descontada.")
footer("Fuentes: Analisis_economico_Proyecto_Cholqui 1,5 % / 2 % / 2,5 % / 3 % — hojas “Eva. Eco.”, “Costos” y “total inversión inicial”.")

# ----------------------------------------------------------------- slide 11
bg()
header("11 · Cash profile", "Perfil de caja de los escenarios")
takeaway("Bajo el plan minero de la planilla, el punto de equilibrio acumulado se alcanza entre el mes 2 y el mes 9 según la ley.", width=690)
c.drawImage(ImageReader("/tmp/ch_cum.png"), 62, 240, 700, 292, mask="auto")
x0 = 790
items = [
    ("Mineral procesado", "166.500 t en 25 períodos"),
    ("Razón estéril / mineral (REM)", "1,5"),
    ("Costo mina en régimen", "~US$ 187 por tonelada movida"),
    ("Inversión inicial", "CLP 243.984.290 (mina, camino, asesorías y contingencias)"),
    ("Punto de equilibrio acumulado", "M9 (1,5 %) · M5 (2,0 %) · M4 (2,5 %) · M2 (3,0 %)"),
    ("VAN / TIR", "[No calculados en la fuente — pendiente de modelo financiero]"),
]
y = 560
for k, v in items:
    text(x0, y, k.upper(), "Mono", 8.5, COPPER)
    yy = wrap(x0, y - 17, v, 418, "Sans", 12, INK, 15)
    rule(x0, yy - 14, 418)
    y = yy - 40
disclaimer(72, 96, "El modelo de la fuente es un flujo operacional no descontado sobre venta de mineral a planta (tarifa ENAMI). No incorpora impuestos, financiamiento, cierre de faena ni permisos. Requiere validación por ingeniería y metalurgia antes de cualquier decisión de inversión.")
footer("Fuentes: Analisis_economico_Proyecto_Cholqui — hojas “Eva. Eco.”, “Plan Mina”, “camino”, “Calculo tarifas”.")

# ----------------------------------------------------------------- slide 12
bg(INK)
header("12 · Roadmap", "Hoja de ruta de creación de valor", dark=True)
takeaway("Capital → de-risking → definición geológica → re-rating del activo.", dark=True)
phases = [
    ("PHASE 01", "Consolidación de datos", "0–3 meses",
     ["Base de datos geológica", "Validación de análisis químicos", "Revisión de propiedad y dominio", "Integración GIS", "Targeting de exploración"]),
    ("PHASE 02", "Definición de blancos", "3–6 meses",
     ["Mapeo geológico", "Geoquímica de superficie", "Gamma-espectrometría 1:10.000", "Zanjas en Cuesta Ancha", "Muestreo sistemático"]),
    ("PHASE 03", "Sondaje", "6–18 meses",
     ["Campaña inicial de sondaje", "Logueo y QA/QC", "Modelamiento geológico", "Sondaje de extensión"]),
    ("PHASE 04", "Definición de recursos", "18+ meses",
     ["Modelo geológico 3D", "Estimación de recursos", "Pruebas metalúrgicas", "Evaluación económica preliminar"]),
]
for i, (p, t, d, items) in enumerate(phases):
    x = 72 + i * 290
    box(x, 190, 268, 300, fill=HexColor("#1A2126"), stroke=HexColor("#2C343B"), radius=3)
    text(x + 20, 456, p, "Mono", 9.5, COPPER)
    text(x + 20, 430, t, "Sans-B", 15, PAPER)
    text(x + 20, 410, d, "Mono", 9, SAND)
    rule(x + 20, 398, 40, HexColor("#3A444C"))
    y = 376
    for it in items:
        y = wrap(x + 20, y, "· " + it, 228, "Sans", 10.5, SLATE_L, 14) - 18
c.setStrokeColor(COPPER)
c.setLineWidth(2)
c.line(72, 160, W - 72, 160)
for i, s in enumerate(["CAPITAL", "DE-RISKING", "DEFINICIÓN GEOLÓGICA", "RE-RATING DEL ACTIVO"]):
    x = 72 + i * 290 + 134
    c.setFillColor(COPPER)
    c.circle(x, 160, 5, stroke=0, fill=1)
    text(x, 138, s, "Mono", 9, SAND, align="c")
disclaimer(72, 82, "Los plazos son una propuesta conceptual editable (subject to technical planning) y dependen de permisos, disponibilidad de equipos y resultados de cada fase.", dark=True)
footer("Fuentes: Trabajos de Exploración y Recomendaciones del Prospecto “Cholqui” (2025); estructuración GeoCapitals.", dark=True)

# ----------------------------------------------------------------- slide 13
bg()
header("13 · Use of funds", "Capital para desbloquear el próximo punto de inflexión")
takeaway("Objetivo: financiar el programa de trabajo que lleva a Cholqui de prospecto geológico a activo mineral técnicamente definido.")
cats = ["Geología y mapeo", "Geofísica (gamma-espectrometría)", "Geoquímica y muestreo",
        "Zanjas y sondaje", "Laboratorio y QA/QC", "Ingeniería y metalurgia",
        "Permisos y medio ambiente", "Administración del proyecto", "Contingencia"]
y = 500
for i, cat in enumerate(cats):
    x = 72 + (i % 3) * 384
    yy = 500 - (i // 3) * 96
    box(x, yy - 44, 352, 76, fill=PAPER_2, stroke=LINE, radius=3)
    text(x + 20, yy + 4, cat, "Sans-B", 12.5, INK)
    text(x + 20, yy - 20, "US$ [ ____ ]", "Mono", 11, COPPER)
    text(x + 332, yy - 20, "[ __ ] %", "Mono", 11, SLATE, align="r")
box(72, 152, 1136, 60, fill=HexColor("#F2E7DC"), stroke=COPPER, radius=3)
text(96, 182, "MONTO TOTAL DE LA FASE", "Mono", 9, COPPER)
text(96, 160, "US$ [ ________ ]", "Sans-B", 20, INK)
text(1184, 176, "Campos editables — a completar con el presupuesto detallado del programa de trabajo", "Sans-I", 11, SLATE, align="r")
disclaimer(72, 90, "No se han asignado porcentajes ni montos: la distribución debe construirse a partir del presupuesto del programa de trabajo aprobado por el equipo geológico y el comité de inversión.")
footer("Fuentes: estructura de programa de trabajo derivada de las recomendaciones técnicas del prospecto; montos pendientes de definición.")

# ----------------------------------------------------------------- slide 14
bg()
header("14 · Investment structure", "Estructura de inversión propuesta")
takeaway("Marco de discusión con GeoCapitals: los términos permanecen abiertos y editables.")
terms = [
    ("Capital Raise", "US$ [ X ]"),
    ("Investment Vehicle", "[ Equity / SPV / JV / Convertible ]"),
    ("Ownership Offered", "[ X ] %"),
    ("Use of Funds", "Exploración y definición de recursos"),
    ("Investment Horizon", "[ X ] meses"),
    ("Target Milestone", "[ Sondaje / Estimación de recursos / Transacción estratégica ]"),
]
y = 505
for i, (k, v) in enumerate(terms):
    x = 72 + (i % 2) * 584
    yy = 505 - (i // 2) * 92
    text(x, yy, k.upper(), "Mono", 9, COPPER)
    text(x, yy - 26, v, "Sans-B", 18, INK)
    rule(x, yy - 44, 552)
c.setStrokeColor(SAND)
c.setLineWidth(2)
c.line(72, 200, W - 72, 200)
stages = ["HOY · ETAPA TEMPRANA", "CAPITAL", "SONDAJE", "DEFINICIÓN DE RECURSOS", "RE-RATING POTENCIAL"]
for i, s in enumerate(stages):
    x = 72 + i * ((W - 144) / 4)
    c.setFillColor(COPPER if i in (0, 4) else GRAPHITE)
    c.circle(x, 200, 6, stroke=0, fill=1)
    align = "l" if i == 0 else ("r" if i == 4 else "c")
    text(x if i not in (4,) else x, 176, s, "Mono", 9, INK, align=align)
disclaimer(72, 96, "No se presenta valorización del activo. Cualquier término económico se definirá tras due diligence técnica, legal y de propiedad minera. Documento preliminar, no constituye oferta ni recomendación de inversión.")
footer("Fuentes: estructuración preliminar GeoCapitals × Proyecto Cholqui — términos por acordar con el titular.")

# ----------------------------------------------------------------- slide 15
bg(INK)
text(72, 560, "WHY CHOLQUI. WHY NOW.", "Sans-B", 44, PAPER)
rule(72, 536, 120, COPPER, 3)
pts = [("5.000 ha", "posición territorial"), ("Cu · Au · Ag", "sistema polimetálico"),
       ("Evidencia", "geológica documentada"), ("Minería activa", "inmediatamente adyacente"),
       ("Chile central", "ubicación estratégica"), ("Ruta técnica", "de exploración definida")]
for i, (v, l) in enumerate(pts):
    x = 72 + (i % 3) * 384
    y = 450 - (i // 3) * 110
    text(x, y, v, "Sans-B", 26, SAND)
    text(x, y - 22, l.upper(), "Mono", 9, SLATE_L)
box(72, 176, 1136, 74, fill=HexColor("#1A2126"), stroke=COPPER, radius=3)
wrap(96, 222, "“An opportunity to participate before geological definition and potential asset re-rating.”",
     1088, "Sans-I", 16, PAPER, 22)
text(96, 192, "GEOCAPITALS × PROYECTO CHOLQUI — Investment & Strategic Partnership Discussion", "Mono", 10, SAND)
text(72, 130, CONTACT, "Mono", 9.5, SLATE_L)
footer("Documento preliminar y confidencial. No constituye oferta, invitación ni recomendación de inversión.", dark=True)

# ----------------------------------------------------------------- slide 16
bg()
header("15 · One-page summary", "One-page investment summary")
pairs = [
    ("Proyecto", "Proyecto Cholqui (ex Distrito Franco) — Volcania Minerals SpA"),
    ("Location", "Cholqui / Cajón de Panamá, Melipilla, Región Metropolitana, Chile"),
    ("Commodity", "Cobre – Oro – Plata (polimetálico)"),
    ("Land Position", "~5.000 ha · 20 pedimentos + 15 pertenencias"),
    ("Current Evidence", "29 puntos de observación; mineralogía Cu–Au–Ag; 4 muestras a laboratorio certificado"),
    ("Neighbouring Ops", "Mina Las Minitas ~15.000 t/mes en ~40 ha; pertenencias de Yamana Gold en el entorno"),
    ("Stage", "Exploración temprana — sin recursos ni reservas declarados; sin sondaje propio"),
    ("Investment Opportunity", "Financiar el programa de exploración que permita definir un activo mineral"),
    ("Use of Funds", "Geología, geofísica, geoquímica, zanjas, sondaje, laboratorio, ingeniería y permisos"),
    ("Next Milestone", "Gamma-espectrometría 1:10.000, zanjas en Cuesta Ancha y primera campaña de sondaje"),
    ("Economics", "Escenarios ilustrativos 1,5–3,0 % Cu: US$ 15,9 – 37,9 M de ingresos sobre 166.500 t (25 meses)"),
    ("Contact", CONTACT),
]
y = 540
for k, v in pairs:
    text(72, y, k.upper(), "Mono", 8.5, COPPER)
    text(300, y, v, "Sans", 12, INK)
    rule(72, y - 12, 1136)
    y -= 38
disclaimer(72, 84, "Resumen preparado exclusivamente con la documentación aportada. No contiene estimación de recursos o reservas minerales bajo NI 43-101, JORC ni estándar equivalente.")
footer("Fuentes: Prospecto “Cholqui” (2025); planillas económicas 1,5–3,0 % Cu; ficha de propiedad minera del titular.")

# ----------------------------------------------------------------- slide 17
bg()
header("Anexos", "Antecedentes técnicos para due diligence")
takeaway("La documentación completa permanece disponible en el data room para revisión técnica y legal.")
annex = [
    ("A1", "Títulos mineros — pedimentos y pertenencias"),
    ("A2", "Acreditación de dominio de las pertenencias"),
    ("A3", "Informes geológicos (J. Arcos Vidal · A. Leman Vargas)"),
    ("A4", "Certificados de análisis químico de laboratorio"),
    ("A5", "Coordenadas de muestreo (Tabla 1, PSAD'56 19H)"),
    ("A6", "Mapas geológicos y catastro de concesiones"),
    ("A7", "Escenario económico 1,5 % Cu"),
    ("A8", "Escenario económico 2,0 % Cu"),
    ("A9", "Escenario económico 2,5 % Cu"),
    ("A10", "Escenario económico 3,0 % Cu"),
    ("A11", "Contratos y fuentes de pago"),
    ("A12", "Material fotográfico"),
    ("A13", "Documentación legal adicional"),
]
for i, (code, t) in enumerate(annex):
    x = 72 + (i % 2) * 584
    y = 500 - (i // 2) * 56
    box(x, y - 16, 552, 44, fill=PAPER_2, stroke=LINE, radius=3)
    text(x + 18, y - 3, code, "Mono-B", 12, COPPER)
    text(x + 66, y - 3, t, "Sans", 12.5, INK)
disclaimer(72, 96, "Estado del data room: A1, A3, A5, A7–A10 disponibles; A2, A4, A6, A11–A13 en carga o pendientes de validación documental.")
footer("Índice de anexos — Proyecto Cholqui / GeoCapitals.")

c.save()
print("deck ok")
