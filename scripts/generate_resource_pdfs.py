#!/usr/bin/env python3
"""
Geocapitals — Generador de PDFs de recursos.

Cada módulo tiene identidad visual propia (color de acento, portada
distinta, KPIs, diagrama de flujo, sección de datos) para que no se
sientan clonados.

Uso:
    python scripts/generate_resource_pdfs.py [--out public/recursos]
"""
from __future__ import annotations

import argparse
import io
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import qrcode
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas

# ---------------------------------------------------------------------------
# Fonts (Unicode — evita cajas negras en acentos)
# ---------------------------------------------------------------------------
def _register_fonts() -> tuple[str, str]:
    regular = subprocess.check_output(
        ["fc-match", "-f", "%{file}", "DejaVu Sans"], text=True
    ).strip()
    bold = subprocess.check_output(
        ["fc-match", "-f", "%{file}", "DejaVu Sans:bold"], text=True
    ).strip()
    pdfmetrics.registerFont(TTFont("Body", regular))
    pdfmetrics.registerFont(TTFont("BodyBold", bold))
    return "Body", "BodyBold"


FONT, FONT_B = _register_fonts()

# ---------------------------------------------------------------------------
# Paleta base (dark institucional)
# ---------------------------------------------------------------------------
BG        = HexColor("#0B1220")   # fondo
SURFACE   = HexColor("#111A2E")   # tarjetas
BORDER    = HexColor("#1F2A44")
TEXT      = HexColor("#E6EDF7")
MUTED     = HexColor("#8FA1BF")
GOLD      = HexColor("#C9A34E")   # acento marca


# ---------------------------------------------------------------------------
# Modelo de módulo
# ---------------------------------------------------------------------------
@dataclass
class Kpi:
    value: str
    label: str


@dataclass
class Step:
    title: str
    body: str


@dataclass
class Module:
    code: str
    title: str
    subtitle: str
    tagline: str
    accent: Color
    accent_soft: Color
    cover_glyph: str      # símbolo grande de portada (icono ASCII/emoji simple)
    why: str
    kpis: list[Kpi]
    section_a: tuple[str, str, list[str]]     # (kicker, título, bullets)
    section_b: tuple[str, str, list[Step]]    # (kicker, título, pasos)
    data_block: tuple[str, list[tuple[str, str]]]  # (título, filas [col1, col2])
    quote: str
    filename: str


CONTACT = {
    "email": "contacto@geocapitals.com",
    "phone": "+56 9 6218 4071",
    "wa":    "https://wa.me/56962184071",
    "site":  "https://geocapitals.com",
}


# ---------------------------------------------------------------------------
# Helpers de dibujo
# ---------------------------------------------------------------------------
PAGE_W, PAGE_H = A4
MARGIN = 18 * mm


def _wrap(c: rl_canvas.Canvas, text: str, font: str, size: float, max_w: float) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = f"{cur} {w}".strip()
        if c.stringWidth(test, font, size) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _draw_text_block(
    c: rl_canvas.Canvas, x: float, y: float, text: str,
    font: str, size: float, leading: float, max_w: float, color: Color = TEXT,
) -> float:
    c.setFillColor(color)
    c.setFont(font, size)
    for line in _wrap(c, text, font, size, max_w):
        c.drawString(x, y, line)
        y -= leading
    return y


def _fill_page(c: rl_canvas.Canvas, color: Color = BG) -> None:
    c.setFillColor(color)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)


def _header_bar(c: rl_canvas.Canvas, mod: Module) -> None:
    c.setFillColor(SURFACE)
    c.rect(0, PAGE_H - 14 * mm, PAGE_W, 14 * mm, stroke=0, fill=1)
    c.setFillColor(mod.accent)
    c.rect(0, PAGE_H - 14 * mm, 4 * mm, 14 * mm, stroke=0, fill=1)
    c.setFillColor(TEXT)
    c.setFont(FONT_B, 8.5)
    c.drawString(MARGIN, PAGE_H - 8 * mm, f"GEOCAPITALS · MÓDULO {mod.code}")
    c.setFillColor(MUTED)
    c.setFont(FONT, 8.5)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - 8 * mm, mod.title.upper())


def _footer(c: rl_canvas.Canvas, mod: Module, page_num: int, total: int) -> None:
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.4)
    c.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
    c.setFont(FONT, 7.5)
    c.setFillColor(MUTED)
    c.drawString(MARGIN, 9 * mm,
                 "Geocapitals · Mining · Capital · Data — Documento formativo. No constituye oferta pública.")
    c.setFillColor(mod.accent)
    c.setFont(FONT_B, 7.5)
    c.drawRightString(PAGE_W - MARGIN, 9 * mm, f"{page_num} / {total}")


def _kicker(c: rl_canvas.Canvas, x: float, y: float, kicker: str, accent: Color) -> None:
    c.setFillColor(accent)
    c.setFont(FONT_B, 8)
    c.drawString(x, y, kicker.upper())


def _section_title(c: rl_canvas.Canvas, x: float, y: float, title: str) -> None:
    c.setFillColor(TEXT)
    c.setFont(FONT_B, 16)
    c.drawString(x, y, title)


def _pill(c: rl_canvas.Canvas, x: float, y: float, text: str, accent: Color) -> float:
    c.setFont(FONT_B, 8)
    w = c.stringWidth(text, FONT_B, 8) + 10
    c.setFillColor(accent)
    c.roundRect(x, y - 3, w, 13, 3, stroke=0, fill=1)
    c.setFillColor(BG)
    c.drawString(x + 5, y, text)
    return x + w + 6


def _kpi_grid(c: rl_canvas.Canvas, y: float, kpis: list[Kpi], mod: Module) -> float:
    n = len(kpis)
    gap = 4 * mm
    total_w = PAGE_W - 2 * MARGIN
    card_w = (total_w - gap * (n - 1)) / n
    card_h = 22 * mm
    for i, k in enumerate(kpis):
        x = MARGIN + i * (card_w + gap)
        c.setFillColor(SURFACE)
        c.roundRect(x, y - card_h, card_w, card_h, 3, stroke=0, fill=1)
        c.setFillColor(mod.accent)
        c.rect(x, y - card_h, card_w, 1.2, stroke=0, fill=1)
        c.setFillColor(TEXT)
        c.setFont(FONT_B, 16)
        c.drawString(x + 5 * mm, y - 10 * mm, k.value)
        c.setFillColor(MUTED)
        c.setFont(FONT, 7.5)
        for j, line in enumerate(_wrap(c, k.label, FONT, 7.5, card_w - 10 * mm)):
            c.drawString(x + 5 * mm, y - 14 * mm - j * 9, line)
    return y - card_h - 6 * mm


def _bullet_list(c: rl_canvas.Canvas, x: float, y: float, items: list[str], accent: Color, max_w: float) -> float:
    for it in items:
        c.setFillColor(accent)
        c.circle(x + 2, y + 3, 1.6, stroke=0, fill=1)
        y = _draw_text_block(c, x + 10, y, it, FONT, 9.5, 12, max_w - 10, TEXT) - 4
    return y


def _steps(c: rl_canvas.Canvas, x: float, y: float, steps: list[Step], accent: Color, max_w: float) -> float:
    for i, s in enumerate(steps, 1):
        c.setFillColor(accent)
        c.roundRect(x, y - 8, 12, 12, 2, stroke=0, fill=1)
        c.setFillColor(BG)
        c.setFont(FONT_B, 8)
        c.drawCentredString(x + 6, y - 5, str(i))
        c.setFillColor(TEXT)
        c.setFont(FONT_B, 10)
        c.drawString(x + 18, y, s.title)
        y2 = _draw_text_block(c, x + 18, y - 12, s.body, FONT, 9, 11.5, max_w - 18, MUTED)
        y = y2 - 6
    return y


def _data_table(c: rl_canvas.Canvas, y: float, title: str, rows: list[tuple[str, str]], mod: Module) -> float:
    _kicker(c, MARGIN, y, "Datos & benchmarks", mod.accent)
    y -= 6
    _section_title(c, MARGIN, y - 8, title)
    y -= 22
    row_h = 9 * mm
    col1_w = 72 * mm
    total_w = PAGE_W - 2 * MARGIN
    for i, (k, v) in enumerate(rows):
        if i % 2 == 0:
            c.setFillColor(SURFACE)
            c.rect(MARGIN, y - row_h + 2, total_w, row_h, stroke=0, fill=1)
        c.setFillColor(TEXT)
        c.setFont(FONT_B, 9)
        c.drawString(MARGIN + 5, y - 4, k)
        c.setFillColor(MUTED)
        c.setFont(FONT, 9)
        for j, line in enumerate(_wrap(c, v, FONT, 9, total_w - col1_w - 10)):
            c.drawString(MARGIN + col1_w, y - 4 - j * 11, line)
        y -= row_h
    return y - 4 * mm


def _qr_png(url: str) -> io.BytesIO:
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Páginas
# ---------------------------------------------------------------------------
def _page_cover(c: rl_canvas.Canvas, mod: Module) -> None:
    _fill_page(c, BG)

    # Barra lateral con color del módulo
    c.setFillColor(mod.accent)
    c.rect(0, 0, 8 * mm, PAGE_H, stroke=0, fill=1)

    # Logo/marca
    c.setFillColor(TEXT)
    c.setFont(FONT_B, 12)
    c.drawString(MARGIN, PAGE_H - 22 * mm, "GEOCAPITALS")
    c.setFillColor(mod.accent)
    c.setFont(FONT_B, 8)
    c.drawString(MARGIN, PAGE_H - 28 * mm, "MINING · CAPITAL · DATA")

    # Bloque de código de módulo grande
    c.setFillColor(mod.accent_soft)
    c.roundRect(MARGIN, PAGE_H - 95 * mm, 60 * mm, 55 * mm, 4, stroke=0, fill=1)
    c.setFillColor(mod.accent)
    c.setFont(FONT_B, 56)
    c.drawString(MARGIN + 6 * mm, PAGE_H - 78 * mm, mod.code)
    c.setFillColor(TEXT)
    c.setFont(FONT_B, 12)
    c.drawString(MARGIN + 6 * mm, PAGE_H - 88 * mm, mod.cover_glyph)

    # Título + subtítulo
    y = PAGE_H - 110 * mm
    c.setFillColor(TEXT)
    c.setFont(FONT_B, 26)
    for line in _wrap(c, mod.title, FONT_B, 26, PAGE_W - 2 * MARGIN):
        c.drawString(MARGIN, y, line)
        y -= 28
    y -= 4
    c.setFillColor(MUTED)
    c.setFont(FONT, 12)
    for line in _wrap(c, mod.subtitle, FONT, 12, PAGE_W - 2 * MARGIN):
        c.drawString(MARGIN, y, line)
        y -= 16

    # Tagline en cinta acento
    y -= 6
    c.setFillColor(SURFACE)
    c.roundRect(MARGIN, y - 24, PAGE_W - 2 * MARGIN, 22, 3, stroke=0, fill=1)
    c.setFillColor(mod.accent)
    c.rect(MARGIN, y - 24, 2, 22, stroke=0, fill=1)
    c.setFillColor(TEXT)
    c.setFont(FONT, 9.5)
    tag_lines = _wrap(c, mod.tagline, FONT, 9.5, PAGE_W - 2 * MARGIN - 14)
    for i, line in enumerate(tag_lines[:2]):
        c.drawString(MARGIN + 8, y - 10 - i * 11, line)

    # QR + contacto
    qr_size = 30 * mm
    qr_x = PAGE_W - MARGIN - qr_size
    qr_y = 22 * mm
    c.drawImage(qrcode.make(CONTACT["wa"]).get_image().filename if False else "",
                0, 0) if False else None
    from reportlab.lib.utils import ImageReader
    c.drawImage(ImageReader(_qr_png(CONTACT["wa"])), qr_x, qr_y, qr_size, qr_size, mask="auto")
    c.setFillColor(MUTED)
    c.setFont(FONT, 7)
    c.drawRightString(PAGE_W - MARGIN, qr_y - 4, "Escanear · WhatsApp")

    c.setFillColor(TEXT)
    c.setFont(FONT_B, 9)
    c.drawString(MARGIN, qr_y + 26, "CONTACTO INSTITUCIONAL")
    c.setFillColor(MUTED)
    c.setFont(FONT, 9)
    c.drawString(MARGIN, qr_y + 16, f"✉ {CONTACT['email']}")
    c.drawString(MARGIN, qr_y + 6, f"✆ WhatsApp {CONTACT['phone']}")
    c.drawString(MARGIN, qr_y - 4, f"◉ {CONTACT['site']}")


def _page_body(c: rl_canvas.Canvas, mod: Module) -> None:
    _fill_page(c, BG)
    _header_bar(c, mod)

    y = PAGE_H - 24 * mm
    # Por qué importa
    _kicker(c, MARGIN, y, "Por qué importa", mod.accent)
    y -= 18
    y = _draw_text_block(c, MARGIN, y, mod.why, FONT, 10.5, 14, PAGE_W - 2 * MARGIN, TEXT) - 8

    # KPIs
    y = _kpi_grid(c, y, mod.kpis, mod)

    # Section A — bullets
    kicker_a, title_a, bullets_a = mod.section_a
    _kicker(c, MARGIN, y, kicker_a, mod.accent)
    y -= 6
    _section_title(c, MARGIN, y - 10, title_a)
    y -= 26
    y = _bullet_list(c, MARGIN, y, bullets_a, mod.accent, PAGE_W - 2 * MARGIN) - 6

    # Section B — steps
    kicker_b, title_b, steps_b = mod.section_b
    _kicker(c, MARGIN, y, kicker_b, mod.accent)
    y -= 6
    _section_title(c, MARGIN, y - 10, title_b)
    y -= 26
    _steps(c, MARGIN, y, steps_b, mod.accent, PAGE_W - 2 * MARGIN)


def _page_data(c: rl_canvas.Canvas, mod: Module) -> None:
    _fill_page(c, BG)
    _header_bar(c, mod)

    y = PAGE_H - 30 * mm
    title, rows = mod.data_block
    y = _data_table(c, y, title, rows, mod)

    # Quote
    y -= 4 * mm
    c.setFillColor(SURFACE)
    c.roundRect(MARGIN, y - 34 * mm, PAGE_W - 2 * MARGIN, 32 * mm, 4, stroke=0, fill=1)
    c.setFillColor(mod.accent)
    c.rect(MARGIN, y - 34 * mm, 3, 32 * mm, stroke=0, fill=1)
    c.setFillColor(TEXT)
    c.setFont(FONT_B, 12)
    inner_x = MARGIN + 10
    inner_w = PAGE_W - 2 * MARGIN - 20
    lines = _wrap(c, f"“{mod.quote}”", FONT_B, 12, inner_w)
    yy = y - 12 * mm
    for line in lines:
        c.drawString(inner_x, yy, line)
        yy -= 15
    c.setFillColor(MUTED)
    c.setFont(FONT, 9)
    c.drawString(inner_x, yy - 6, "— Equipo Geocapitals")


def _page_contact(c: rl_canvas.Canvas, mod: Module) -> None:
    _fill_page(c, BG)
    _header_bar(c, mod)

    y = PAGE_H - 30 * mm
    _kicker(c, MARGIN, y, "Siguiente paso", mod.accent)
    y -= 6
    _section_title(c, MARGIN, y - 10, "Hablemos de tu proyecto")
    y -= 30
    _draw_text_block(
        c, MARGIN, y,
        "Somos el partner tecnológico y financiero para la próxima generación "
        "de proyectos mineros en LATAM. Agenda una demo, valida tu prospecto "
        "o explora oportunidades de inversión.",
        FONT, 10.5, 14, PAGE_W - 2 * MARGIN, MUTED,
    )

    # Tarjeta de contacto grande + QR
    card_y = 60 * mm
    card_h = 70 * mm
    c.setFillColor(SURFACE)
    c.roundRect(MARGIN, card_y, PAGE_W - 2 * MARGIN, card_h, 4, stroke=0, fill=1)
    c.setFillColor(mod.accent)
    c.rect(MARGIN, card_y, 3, card_h, stroke=0, fill=1)

    c.setFillColor(TEXT)
    c.setFont(FONT_B, 10)
    c.drawString(MARGIN + 12, card_y + card_h - 14, "CONTACTO DIRECTO")
    c.setFont(FONT_B, 14)
    c.drawString(MARGIN + 12, card_y + card_h - 30, "Equipo Geocapitals")

    c.setFillColor(MUTED)
    c.setFont(FONT, 10.5)
    c.drawString(MARGIN + 12, card_y + card_h - 46, f"✉  {CONTACT['email']}")
    c.drawString(MARGIN + 12, card_y + card_h - 60, f"✆  {CONTACT['phone']}")
    c.drawString(MARGIN + 12, card_y + 16, f"◉  {CONTACT['site']}")

    # QRs
    from reportlab.lib.utils import ImageReader
    qr_size = 34 * mm
    qr1_x = PAGE_W - MARGIN - qr_size - 10
    qr1_y = card_y + (card_h - qr_size) / 2
    c.drawImage(ImageReader(_qr_png(CONTACT["wa"])), qr1_x, qr1_y, qr_size, qr_size, mask="auto")
    c.setFillColor(MUTED)
    c.setFont(FONT, 7.5)
    c.drawCentredString(qr1_x + qr_size / 2, qr1_y - 6, "WhatsApp")

    qr2_size = 34 * mm
    qr2_x = qr1_x - qr2_size - 8
    qr2_y = qr1_y
    c.drawImage(ImageReader(_qr_png(CONTACT["site"])), qr2_x, qr2_y, qr2_size, qr2_size, mask="auto")
    c.drawCentredString(qr2_x + qr2_size / 2, qr2_y - 6, "geocapitals.com")


# ---------------------------------------------------------------------------
# Render de un módulo completo
# ---------------------------------------------------------------------------
PAGES: list[Callable[[rl_canvas.Canvas, Module], None]] = [
    _page_cover, _page_body, _page_data, _page_contact,
]


def render_module(mod: Module, out_dir: Path) -> Path:
    out = out_dir / mod.filename
    c = rl_canvas.Canvas(str(out), pagesize=A4)
    c.setTitle(f"Geocapitals · {mod.code} · {mod.title}")
    c.setAuthor("Geocapitals")
    c.setSubject(mod.subtitle)
    total = len(PAGES)
    for i, page_fn in enumerate(PAGES, 1):
        page_fn(c, mod)
        if i > 1:
            _footer(c, mod, i, total)
        c.showPage()
    c.save()
    return out


# ---------------------------------------------------------------------------
# Datos por módulo — 4 identidades distintas
# ---------------------------------------------------------------------------
def build_modules() -> list[Module]:
    return [
        Module(
            code="M01",
            title="Geocapitals en 15 minutos",
            subtitle="Del prospecto geológico al inversor institucional, en una sola plataforma.",
            tagline="Overview ejecutivo para equipos técnicos, family offices y comités de inversión.",
            accent=HexColor("#C9A34E"), accent_soft=HexColor("#3A2E15"),
            cover_glyph="OVERVIEW",
            why=("Unificamos catastro, geodata satelital, evaluación NI 43-101 y capital privado "
                 "en un stack digital diseñado para la próxima generación de proyectos mineros en LATAM."),
            kpis=[
                Kpi("135", "Tablas operativas en el core"),
                Kpi("35",  "Edge functions productivas"),
                Kpi("+18", "Datasets geoespaciales integrados"),
                Kpi("24 h","SLA institucional de respuesta"),
            ],
            section_a=(
                "Qué hacemos",
                "Una infraestructura para minería moderna",
                [
                    "Catastro & titularidad: vigilancia continua de concesiones, servidumbres y hitos legales.",
                    "Sensado remoto: Sentinel, Landsat, Copernicus DEM y anomalías espectrales georreferenciadas.",
                    "Motor 3D geológico: DEM + drape satelital + capas de anomalías extruidas en WGS84.",
                    "Evaluación NI 43-101: flujos guiados con QP, trazabilidad documental y control de versiones.",
                    "Capital & deal room: pipeline institucional, KYC/AML y estructura crowdfunding profesional.",
                ],
            ),
            section_b=(
                "Cómo se usa",
                "Flujo típico de un caso Geocapitals",
                [
                    Step("Descubrir", "El equipo técnico carga coordenadas o polígono; la plataforma corre validación catastral, huella satelital y anomalías espectrales en minutos."),
                    Step("Modelar",   "Con Geology3DViewer se construye la escena 3D real: relieve, drape RGB, anomalías y perfiles cruzados."),
                    Step("Evaluar",   "Se estructura el reporte NI 43-101 con QP asignado, checklist y trazabilidad."),
                    Step("Capitalizar","Se publica el deal en el mercado institucional con tiers de inversión y roadmap de tokenización."),
                ],
            ),
            data_block=(
                "Alcance actual de la plataforma",
                [
                    ("Cobertura geográfica", "Chile, Perú, Argentina, Colombia, México (fase 1 LATAM)."),
                    ("Commodities activos",  "Cu, Au, Ag, Li, Zn, Mo, tierras raras (piloto)."),
                    ("Frecuencia satelital", "Sentinel-2 cada 5 días · Landsat cada 16 días."),
                    ("Stack backend",         "PostgreSQL 15 + PostGIS 3.3.7, pg_cron, pg_net, edge functions."),
                    ("Frontend",              "TanStack Start · React 19 · Tailwind v4 · WebGL 3D."),
                    ("Seguridad",             "RLS granular, roles por organización, auditoría de eventos."),
                ],
            ),
            quote="Geocapitals convierte 18 meses de due diligence tradicional en un flujo digital, auditado y comparable entre proyectos.",
            filename="geocapitals-m01-overview.pdf",
        ),

        Module(
            code="M02",
            title="Inversión y capital minero",
            subtitle="Crowdfunding institucional, deal room privado y hoja de ruta hacia la tokenización.",
            tagline="Guía para inversionistas retail cualificados, family offices y actores institucionales.",
            accent=HexColor("#3FB59A"), accent_soft=HexColor("#0F332C"),
            cover_glyph="CAPITAL",
            why=("Diseñamos un mercado de capital para minería en el que retail cualificado, family offices y "
                 "actores institucionales operan bajo los mismos estándares de KYC, AML y trazabilidad on-chain."),
            kpis=[
                Kpi("USD 5K",   "Ticket mínimo QI"),
                Kpi("USD 250K", "Ticket institucional"),
                Kpi("3",        "Tiers de acceso al deal room"),
                Kpi("2027",     "Commodities on-chain (target)"),
            ],
            section_a=(
                "Modelo",
                "Tres tiers, un mismo estándar",
                [
                    "Observer: acceso libre a fichas públicas, dashboards de mercado y reportes ejecutivos.",
                    "Retail QI: inversionista calificado, ticket USD 5K–50K, KYC completo, reporting trimestral.",
                    "Institutional: family offices y fondos, ticket USD 250K+, cap-table digital, gobernanza on-chain.",
                    "Reporting armonizado: NAV, hitos técnicos y avance de compromisos, en la misma vista.",
                ],
            ),
            section_b=(
                "Roadmap",
                "Del cap-table al commodity tokenizado",
                [
                    Step("Fase 1", "Cap-table digital y suscripción fraccionada con custodia regulada."),
                    Step("Fase 2", "Tokenización del proyecto (Q3 2026): security tokens con derechos económicos."),
                    Step("Fase 3", "Commodities on-chain (2027): off-take digital y liquidez secundaria."),
                    Step("Fase 4", "Marketplace institucional cross-border en LATAM."),
                ],
            ),
            data_block=(
                "Benchmarks de mercado (referenciales)",
                [
                    ("US$/ha grassroots",     "150–800 (Chile/Perú) · S&P CapIQ + SEDAR+."),
                    ("US$/ha advanced expl.", "1.500–6.000, dependiendo de recursos declarados."),
                    ("In-situ Cu (early)",    "0,5 %–2 % del valor spot × recurso inferido."),
                    ("Hurdle rate típico",    "IRR objetivo 25 %+ para PEA en jurisdicción LATAM."),
                    ("KYC / AML",             "Verificación biométrica + PEP + sanctions screening."),
                    ("Custodia",              "Wallets institucionales + smart contracts auditados."),
                ],
            ),
            quote="Un inversor no debería elegir entre rigor institucional y experiencia digital moderna. Geocapitals entrega ambas.",
            filename="geocapitals-m02-inversion.pdf",
        ),

        Module(
            code="M03",
            title="Datos, satélites y motor 3D",
            subtitle="El corazón técnico de la plataforma: geodata, sensado remoto y visualización 3D real.",
            tagline="Referencia técnica para geólogos, data scientists y equipos de exploración.",
            accent=HexColor("#5FA8FF"), accent_soft=HexColor("#0E243F"),
            cover_glyph="GEODATA",
            why=("Cada proyecto en Geocapitals se apoya en un stack de datos abiertos y propietarios que "
                 "permite tomar decisiones con evidencia geoespacial, no con narrativa."),
            kpis=[
                Kpi("+18",             "Datasets integrados"),
                Kpi("10 m",            "Resolución DEM efectiva"),
                Kpi("Sentinel/Landsat","Constelaciones activas"),
                Kpi("PostGIS 3.3",     "Motor geoespacial"),
            ],
            section_a=(
                "Fuentes",
                "Datos que alimentan cada decisión",
                [
                    "Copernicus DEM 30 m + refinamiento local a 10 m sobre polígonos activos.",
                    "Sentinel-2 L2A (MPC): bandas ópticas + NDVI/NDWI para huella y humedad.",
                    "Landsat 8/9: series históricas y detección multitemporal (1985–hoy).",
                    "Geofísica pública: anomalías magnéticas, gravimétricas y radiométricas normalizadas.",
                    "Catastro oficial: concesiones, servidumbres, ANP y restricciones ambientales.",
                ],
            ),
            section_b=(
                "Motor 3D",
                "Geology3DViewer + scene3d.server",
                [
                    Step("Terreno",    "DEM Copernicus procesado server-side y servido como mesh optimizado."),
                    Step("Drape",      "Composición RGB satelital (Sentinel MPC) proyectada sobre el terreno."),
                    Step("Anomalías",  "Capas espectrales y geofísicas extruidas y coloreadas por intensidad."),
                    Step("Interacción","Cross-section, medidas, targets AI y export a informe técnico."),
                ],
            ),
            data_block=(
                "Especificaciones técnicas",
                [
                    ("Proyección base",   "WGS84 (EPSG:4326) · reproyecciones automáticas para vecindad."),
                    ("Formato de tiles",  "COG + STAC · caché regional en edge."),
                    ("Cadena ETL",        "pg_cron + pg_net → edge functions → tablas geoespaciales."),
                    ("Anomalías",         "Score normalizado 0–1 con confianza y fuente auditables."),
                    ("Latencia visor",    "First interaction < 3 s en LATAM (P95)."),
                    ("APIs",              "REST + tRPC-style server functions con RLS por proyecto."),
                ],
            ),
            quote="La geología no se argumenta, se muestra. Nuestro motor 3D convierte cada dataset en evidencia visible.",
            filename="geocapitals-m03-datos.pdf",
        ),

        Module(
            code="M04",
            title="NI 43-101 digital",
            subtitle="Reporting técnico auditable, con QP asignado y trazabilidad documental completa.",
            tagline="Manual operativo para QPs, gerentes de exploración y comités técnicos.",
            accent=HexColor("#E86A5C"), accent_soft=HexColor("#3A1613"),
            cover_glyph="NI 43-101",
            why=("El estándar NI 43-101 es la puerta al capital institucional. Geocapitals lo convierte en un "
                 "flujo digital vivo: cada supuesto, dato y firma queda registrado y comparable."),
            kpis=[
                Kpi("23",   "Ítems normativos cubiertos"),
                Kpi("QP",   "Firma responsable por reporte"),
                Kpi("100%", "Trazabilidad de fuentes"),
                Kpi("PEA→FS","Cobertura por fase técnica"),
            ],
            section_a=(
                "Estructura",
                "Un reporte auditable de extremo a extremo",
                [
                    "Ítems 1–5: resumen ejecutivo, propiedad, accesibilidad e historia.",
                    "Ítems 6–12: geología, exploración, drilling, QA/QC y verificación de datos.",
                    "Ítems 13–22: procesamiento, estimación de recursos, escenarios económicos, medio ambiente y permisos.",
                    "Cada campo cita fuente, autor y versión; el QP firma criptográficamente el bundle.",
                ],
            ),
            section_b=(
                "Flujo QP",
                "Del dato crudo a un reporte firmado",
                [
                    Step("Ingesta",    "Carga masiva de drillholes, assays y logs; validación QA/QC automática."),
                    Step("Modelo",     "Estimación de recursos con parámetros trazables y cutoff configurable."),
                    Step("Escenarios", "Precios, capex, opex, recuperaciones → NPV/IRR por commodity."),
                    Step("Firma QP",   "Bundle inmutable con hash + timestamp; exportable a PDF NI 43-101 completo."),
                ],
            ),
            data_block=(
                "Controles y cumplimiento",
                [
                    ("QA/QC drilling",     "Duplicados, blanks, estándares certificados por lote."),
                    ("Estimación",         "OK, ID² o NN; validación cruzada block-composite."),
                    ("Clasificación",      "Inferido / Indicado / Medido según CIM Best Practice 2019."),
                    ("Auditoría",          "Timeline inmutable de cada cambio, con actor y motivo."),
                    ("Formatos de export", "PDF NI 43-101, XLSX de tablas técnicas, JSON para due diligence."),
                    ("Idiomas",             "ES / EN, plantilla armonizada CIM–SAMREC."),
                ],
            ),
            quote="Un NI 43-101 no debería vivir en un PDF estático. Debe ser una base de datos firmable, comparable y transparente.",
            filename="geocapitals-m04-ni43101.pdf",
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="public/recursos")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    for mod in build_modules():
        path = render_module(mod, out_dir)
        print(f"✓ {path}  ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
