#!/usr/bin/env python3
"""Generador de documentos PDF con identidad GeoCapitals.

Documentos:
  1. KYC / precalificación de proveedores  -> 6 páginas
  2. Ficha de oferta (desde YAML)           -> 2 páginas

Render: chromium headless --print-to-pdf sobre A4 (medidas reales, sin factor
de escala). Verificación de páginas: pdfinfo (poppler).

Regla inviolable: NO inventar datos. Todo campo sin valor confirmado se
renderiza como "Por confirmar" (ámbar, negrita). Los escenarios de ley del
material son SUPUESTOS de cálculo, rotulados como tales.

Uso:
  python generate.py kyc [--lang es|en]
  python generate.py ficha data/au_conc_202608.yml
  python generate.py all
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import date
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape

# --------------------------------------------------------------------------
# Constantes de marca y contacto (vacías por defecto -> "Por confirmar").
# --------------------------------------------------------------------------
ORG_NAME = "GeoCapitals"
ORG_TAGLINE_ES = "Catastro minero · Certificación · Intermediación de commodities"
ORG_TAGLINE_EN = "Mining tenure · Certification · Commodity intermediation"
CONTACT_EMAIL = ""          # p.ej. "info@geocapitals.com" — se deja vacío
CONTACT_PHONE = ""
CONTACT_WEB = ""

TROY_OZ_G = 31.1034768       # gramos por onza troy

# --------------------------------------------------------------------------
# Textos del KYC (bilingüe). Contenido de marco/proceso, no datos de terceros.
# --------------------------------------------------------------------------
KYC_STRINGS = {
    "es": {
        "doc_title": "Marco de precalificación de proveedores (KYC)",
        "doc_kind": "Documento de cumplimiento · Uso interno y de contraparte",
        "lead": "Este marco define los antecedentes que GeoCapitals solicita para "
                "precalificar a un proveedor o contraparte antes de habilitar una "
                "operación de intermediación de commodities. Su objetivo es acreditar "
                "identidad, capacidad y trazabilidad del material, y gestionar el "
                "riesgo legal, tributario y de origen. No sustituye la asesoría legal "
                "de cada operación.",
        "sec_alcance": "1. Alcance y principios",
        "sec_identidad": "2. Identificación de la contraparte",
        "sec_legal": "3. Antecedentes legales y tributarios",
        "sec_operativa": "4. Capacidad operativa, ambiental y de seguridad",
        "sec_material": "5. Trazabilidad y origen del material",
        "sec_riesgo": "6. Evaluación de riesgo y sanciones",
        "sec_checklist": "7. Lista de verificación documental",
        "sec_declaracion": "8. Declaración y firmas",
        "status_pending": "Pendiente",
        "status_received": "Recibido",
        "status_verified": "Verificado",
        "col_doc": "Documento / antecedente",
        "col_status": "Estado",
        "col_notes": "Notas",
        "page": "Página",
        "reviewer": "Revisor GeoCapitals",
        "counterparty": "Contraparte",
        "date": "Fecha",
        "signature": "Firma",
        "principios": [
            "No se habilita ninguna operación sin identidad de contraparte verificada.",
            "El origen y la trazabilidad del material se acreditan documentalmente; "
            "un dato no verificado no se presenta como verificado.",
            "Los antecedentes se conservan bajo confidencialidad y se usan solo para "
            "la evaluación de la operación.",
            "La precalificación no constituye garantía comercial ni asesoría legal; "
            "cada operación mantiene su propia diligencia.",
        ],
        "id_fields": [
            "Razón social", "Nombre de fantasía", "RUT / ID tributario", "País de constitución",
            "Domicilio legal", "Giro / actividad", "Sitio web", "Fecha de constitución",
        ],
        "rep_intro": "Representantes legales y personas con poder de firma:",
        "legal_docs": [
            "Escritura de constitución y estatutos vigentes",
            "Certificado de vigencia de la sociedad",
            "Certificado de vigencia de poderes (representante legal)",
            "Inscripción / rol tributario vigente",
            "Certificado de cumplimiento tributario",
            "Declaración de beneficiario final (UBO)",
            "Poderes bancarios y datos de cuenta para pagos",
        ],
        "op_docs": [
            "Permisos de operación / faena vigentes",
            "Resolución de calificación ambiental (si aplica)",
            "Plan de manejo de residuos / sustancias peligrosas",
            "Registro y protocolos de seguridad y salud ocupacional",
            "Capacidad instalada declarada (producción / almacenamiento)",
            "Seguros vigentes (responsabilidad civil / transporte)",
        ],
        "mat_intro": "Antecedentes del material objeto de la operación:",
        "mat_fields": [
            "Descripción del material", "Origen (faena / región)", "Forma de presentación",
            "Certificado de análisis (assay) de laboratorio acreditado",
            "Cadena de custodia / trazabilidad", "Documentación de transporte y despacho",
        ],
        "riesgo_items": [
            "Cribado de listas de sanciones y PEP de la contraparte y sus UBO.",
            "Verificación de origen lícito del material y ausencia de gravámenes.",
            "Evaluación de riesgo país, sector y contraparte.",
            "Revisión de litigios o sanciones ambientales / laborales relevantes.",
        ],
        "checklist_title": "Resumen de estado documental",
        "declaracion": "La contraparte declara que la información y los documentos "
                       "entregados son veraces, completos y vigentes a la fecha de firma, "
                       "y autoriza a GeoCapitals a verificarlos para efectos de la "
                       "precalificación. Cualquier cambio material debe comunicarse por escrito.",
    },
    "en": {
        "doc_title": "Supplier pre-qualification framework (KYC)",
        "doc_kind": "Compliance document · Internal and counterparty use",
        "lead": "This framework defines the records GeoCapitals requests to "
                "pre-qualify a supplier or counterparty before enabling a commodity "
                "intermediation deal. Its purpose is to establish identity, capacity "
                "and material traceability, and to manage legal, tax and origin risk. "
                "It does not replace deal-specific legal advice.",
        "sec_alcance": "1. Scope and principles",
        "sec_identidad": "2. Counterparty identification",
        "sec_legal": "3. Legal and tax records",
        "sec_operativa": "4. Operational, environmental and safety capacity",
        "sec_material": "5. Material traceability and origin",
        "sec_riesgo": "6. Risk and sanctions screening",
        "sec_checklist": "7. Documentary checklist",
        "sec_declaracion": "8. Declaration and signatures",
        "status_pending": "Pending",
        "status_received": "Received",
        "status_verified": "Verified",
        "col_doc": "Document / record",
        "col_status": "Status",
        "col_notes": "Notes",
        "page": "Page",
        "reviewer": "GeoCapitals reviewer",
        "counterparty": "Counterparty",
        "date": "Date",
        "signature": "Signature",
        "principios": [
            "No deal is enabled without a verified counterparty identity.",
            "Material origin and traceability are established through documents; an "
            "unverified record is never presented as verified.",
            "Records are kept confidential and used solely to assess the deal.",
            "Pre-qualification is neither a commercial guarantee nor legal advice; "
            "each deal keeps its own diligence.",
        ],
        "id_fields": [
            "Legal name", "Trade name", "Tax ID", "Country of incorporation",
            "Registered address", "Line of business", "Website", "Incorporation date",
        ],
        "rep_intro": "Legal representatives and authorised signatories:",
        "legal_docs": [
            "Deed of incorporation and current bylaws",
            "Certificate of good standing",
            "Certificate of powers of attorney (legal representative)",
            "Current tax registration",
            "Tax compliance certificate",
            "Ultimate beneficial owner (UBO) declaration",
            "Banking powers and account details for payment",
        ],
        "op_docs": [
            "Current operating / site permits",
            "Environmental permit (if applicable)",
            "Waste / hazardous-substance management plan",
            "Occupational health and safety registry and protocols",
            "Declared installed capacity (production / storage)",
            "Current insurance (liability / transport)",
        ],
        "mat_intro": "Records of the material subject to the deal:",
        "mat_fields": [
            "Material description", "Origin (site / region)", "Form of presentation",
            "Assay certificate from an accredited laboratory",
            "Chain of custody / traceability", "Transport and dispatch documentation",
        ],
        "riesgo_items": [
            "Sanctions and PEP screening of the counterparty and its UBOs.",
            "Verification of lawful origin of the material and absence of liens.",
            "Country, sector and counterparty risk assessment.",
            "Review of relevant litigation or environmental / labour sanctions.",
        ],
        "checklist_title": "Documentary status summary",
        "declaracion": "The counterparty declares that the information and documents "
                       "provided are truthful, complete and current as of the signing "
                       "date, and authorises GeoCapitals to verify them for "
                       "pre-qualification purposes. Any material change must be "
                       "communicated in writing.",
    },
}

ROOT = Path(__file__).resolve().parent
BRAND = ROOT / "brand"
TEMPLATES = ROOT / "templates"
OUT = ROOT / "out"

CHROMIUM_CANDIDATES = [
    "/opt/pw-browsers/chromium",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "chromium",
    "chromium-browser",
    "google-chrome",
]


# --------------------------------------------------------------------------
# Utilidades de dominio
# --------------------------------------------------------------------------
def find_chromium() -> str:
    for c in CHROMIUM_CANDIDATES:
        p = Path(c)
        if p.exists():
            return str(p)
        # nombre en PATH
        from shutil import which
        w = which(c)
        if w:
            return w
    sys.exit("ERROR: no se encontró chromium para el render PDF.")


def logo_ref() -> str | None:
    """Devuelve una data-URI o ruta del logo si existe, o None (símbolo tipográfico)."""
    for name in ("logo-geocapitals.svg", "logo-geocapitals.png"):
        p = BRAND / name
        if p.exists():
            import base64
            mime = "image/svg+xml" if p.suffix == ".svg" else "image/png"
            b64 = base64.b64encode(p.read_bytes()).decode()
            return f"data:{mime};base64,{b64}"
    return None


def css_inline() -> str:
    return (BRAND / "geocapitals.css").read_text(encoding="utf-8")


# Metales preciosos: se reportan en onza troy además de masa.
PRECIOUS = {"AU", "AG", "PT", "PD", "ORO", "PLATA"}


def compute_fino(toneladas, leyes, unidad="g/t", metal="Au"):
    """Contenido fino por escenario de ley. Devuelve (filas, columnas, caption).

    unidad 'g/t'  -> gramos = t·1000·(g/t); oz troy si es metal precioso.
    unidad '%'    -> metal contenido (t) = t·(%/100); base para metales base
                     (Cu, Sb) y para compuestos (Li como Li2CO3, etc.).
    Es un cálculo sobre supuestos de ley, NO un ensaye.
    """
    if not toneladas or not leyes:
        return [], [], ""
    t = float(toneladas)
    u = (unidad or "g/t").strip().lower()
    m = (metal or "").strip().upper()
    rows = []
    if u in ("%", "pct", "porcentaje"):
        for ley in leyes:
            cont_t = t * float(ley) / 100.0
            rows.append({"ley": ley, "cont_t": round(cont_t, 3), "cont_kg": round(cont_t * 1000, 1)})
        cols = [("ley", f"Escenario de ley (% {metal})", 2),
                ("cont_t", "Metal contenido (t)", 3),
                ("cont_kg", "Metal contenido (kg)", 1)]
        cap = "Contenido = t × (%/100). Supuesto de cálculo; el contenido real se fija por assay."
    else:  # g/t
        precious = m in PRECIOUS
        for ley in leyes:
            gramos = t * 1000.0 * float(ley)
            row = {"ley": ley, "gramos": round(gramos, 0), "kg": round(gramos / 1000.0, 2)}
            if precious:
                row["oz_troy"] = round(gramos / TROY_OZ_G, 1)
            rows.append(row)
        cols = [("ley", f"Escenario de ley (g/t {metal})", 0),
                ("gramos", "Fino (g)", 0), ("kg", "Fino (kg)", 2)]
        if precious:
            cols.append(("oz_troy", "Fino (oz troy)", 1))
        cap = ("g = t × 1000 × (g/t); oz troy = g / 31.1034768. "
               "Supuesto de cálculo; el fino real se fija por assay.")
    return rows, cols, cap


# --------------------------------------------------------------------------
# Jinja
# --------------------------------------------------------------------------
def jinja_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )

    from markupsafe import Markup, escape

    def tbc(value, label="Por confirmar"):
        """Filtro: renderiza campos vacíos como marca 'Por confirmar' (ámbar)."""
        if value is None or value == "" or value == []:
            return Markup(f'<span class="tbc">{escape(label)}</span>')
        return escape(value)

    def num(value, dec=0):
        if value is None or value == "":
            return Markup('<span class="tbc">—</span>')
        try:
            return Markup(f"{float(value):,.{int(dec)}f}".replace(",", " "))
        except (ValueError, TypeError):
            return escape(value)

    env.filters["tbc"] = tbc
    env.filters["num"] = num
    return env


# --------------------------------------------------------------------------
# Render
# --------------------------------------------------------------------------
def render_html_to_pdf(html: str, pdf_path: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tmp_html = pdf_path.with_suffix(".html")
    tmp_html.write_text(html, encoding="utf-8")
    chromium = find_chromium()
    cmd = [
        chromium, "--headless=new", "--no-sandbox", "--disable-gpu",
        "--no-pdf-header-footer",
        "--print-to-pdf-no-header",
        f"--print-to-pdf={pdf_path}",
        f"file://{tmp_html}",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if not pdf_path.exists():
        sys.exit(f"ERROR render chromium:\n{res.stderr}")


def pdf_page_count(pdf_path: Path) -> int:
    """Cuenta páginas. Usa pdfinfo (poppler) si está; si no, parsea el PDF en
    Python puro (no todos los contenedores traen poppler; pypdf está roto acá)."""
    try:
        out = subprocess.run(["pdfinfo", str(pdf_path)], capture_output=True, text=True)
        for line in out.stdout.splitlines():
            if line.lower().startswith("pages:"):
                return int(line.split(":")[1].strip())
    except (FileNotFoundError, ValueError):
        pass
    return _page_count_pure(pdf_path)


def _page_count_pure(pdf_path: Path) -> int:
    import re
    import zlib
    data = Path(pdf_path).read_bytes()
    m = re.findall(rb'/Type\s*/Pages\b[^>]*?/Count\s+(\d+)', data) \
        or re.findall(rb'/Count\s+(\d+)[^>]*?/Type\s*/Pages\b', data)
    if m:
        return max(int(x) for x in m)
    n = len(re.findall(rb'/Type\s*/Page[^s]', data))
    if n:
        return n
    total = 0
    for obj in re.findall(rb'stream\r?\n(.*?)\r?\nendstream', data, re.S):
        try:
            d = zlib.decompress(obj)
        except Exception:
            continue
        mm = re.findall(rb'/Type\s*/Pages\b[^>]*?/Count\s+(\d+)', d)
        if mm:
            return max(int(x) for x in mm)
        total += len(re.findall(rb'/Type\s*/Page[^s]', d))
    return total or -1


# --------------------------------------------------------------------------
# Documentos
# --------------------------------------------------------------------------
def build_kyc(lang: str = "es") -> Path:
    env = jinja_env()
    tpl = env.get_template("kyc.html")
    ctx = {
        "org_name": ORG_NAME,
        "tagline": ORG_TAGLINE_EN if lang == "en" else ORG_TAGLINE_ES,
        "lang": lang,
        "t": KYC_STRINGS[lang],
        "css": css_inline(),
        "logo": logo_ref(),
        "fecha": date.today().isoformat(),
        "contact_email": CONTACT_EMAIL,
        "contact_phone": CONTACT_PHONE,
        "contact_web": CONTACT_WEB,
    }
    html = tpl.render(**ctx)
    pdf = OUT / "GEOCAPITALS_KYC_Precalificacion_Proveedores.pdf"
    render_html_to_pdf(html, pdf)
    return pdf


def build_dd(json_path: Path) -> Path:
    """Reporte PDF de due diligence catastral desde el JSON de
    get_cadastre_reconciliation ({run, has_snapshots, findings})."""
    import json as _json
    data = _json.loads(json_path.read_text(encoding="utf-8"))
    run = dict(data.get("run") or {})
    run["has_snapshots"] = data.get("has_snapshots", False)
    rid = str(run.get("id") or "")
    run["id_short"] = (rid[:8] if rid else None)
    summary = run.get("summary") or {}
    findings = data.get("findings") or []
    disclaimer = data.get("disclaimer") or (
        "Análisis automatizado de apoyo. No constituye estudio de títulos, "
        "certificación de dominio ni opinión jurídica.")

    env = jinja_env()
    tpl = env.get_template("dd_catastro.html")
    html = tpl.render(
        org_name=ORG_NAME, tagline=ORG_TAGLINE_ES, css=css_inline(), logo=logo_ref(),
        run=run, summary=summary, findings=findings, disclaimer=disclaimer,
        contact_email=CONTACT_EMAIL, contact_phone=CONTACT_PHONE,
    )
    tag = run["id_short"] or "SIN_ID"
    pdf = OUT / f"GEOCAPITALS_DueDiligence_Catastro_{tag}.pdf"
    render_html_to_pdf(html, pdf)
    return pdf


def build_ficha(yml_path: Path) -> Path:
    data = yaml.safe_load(yml_path.read_text(encoding="utf-8"))
    env = jinja_env()
    tpl = env.get_template("ficha_oferta.html")

    toneladas = (data.get("cantidad") or {}).get("toneladas")
    ley_block = data.get("ley") or {}
    unidad = ley_block.get("unidad", "g/t")
    metal = ley_block.get("metal", "Au")
    # Compatibilidad: acepta 'escenarios_ley' o el antiguo 'escenarios_ley_gpt'.
    leyes = data.get("escenarios_ley") or data.get("escenarios_ley_gpt") or []
    fino_rows, fino_cols, fino_cap = compute_fino(toneladas, leyes, unidad, metal)

    ctx = {
        "org_name": ORG_NAME,
        "tagline": ORG_TAGLINE_ES,
        "css": css_inline(),
        "logo": logo_ref(),
        "d": data,
        "fino_rows": fino_rows,
        "fino_cols": fino_cols,
        "fino_cap": fino_cap,
        "troy_oz_g": TROY_OZ_G,
        "contact_email": CONTACT_EMAIL,
        "contact_phone": CONTACT_PHONE,
        "contact_web": CONTACT_WEB,
    }
    html = tpl.render(**ctx)
    ref = (data.get("ref") or "SIN_REF").replace("/", "-")
    pdf = OUT / f"GEOCAPITALS_Ficha_Oferta_{ref}.pdf"
    render_html_to_pdf(html, pdf)
    return pdf


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description="Generador de documentos GeoCapitals")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_kyc = sub.add_parser("kyc", help="KYC / precalificación de proveedores (6 pp)")
    p_kyc.add_argument("--lang", default="es", choices=["es", "en"])

    p_ficha = sub.add_parser("ficha", help="Ficha de oferta desde YAML (2 pp)")
    p_ficha.add_argument("yml", type=Path)

    p_dd = sub.add_parser("dd", help="Reporte de due diligence catastral desde JSON")
    p_dd.add_argument("json", type=Path)

    sub.add_parser("all", help="KYC (es) + ficha + due diligence de los ejemplos")

    args = ap.parse_args()

    if args.cmd == "kyc":
        pdf = build_kyc(args.lang)
        print(f"[kyc]   {pdf}  ->  {pdf_page_count(pdf)} páginas")
    elif args.cmd == "ficha":
        pdf = build_ficha(args.yml)
        print(f"[ficha] {pdf}  ->  {pdf_page_count(pdf)} páginas")
    elif args.cmd == "dd":
        pdf = build_dd(args.json)
        print(f"[dd]    {pdf}  ->  {pdf_page_count(pdf)} páginas")
    elif args.cmd == "all":
        k = build_kyc("es")
        print(f"[kyc]   {k}  ->  {pdf_page_count(k)} páginas")
        f = build_ficha(ROOT / "data" / "au_conc_202608.yml")
        print(f"[ficha] {f}  ->  {pdf_page_count(f)} páginas")
        dd_json = ROOT / "data" / "dd_catastro_ejemplo.json"
        if dd_json.exists():
            d = build_dd(dd_json)
            print(f"[dd]    {d}  ->  {pdf_page_count(d)} páginas")


if __name__ == "__main__":
    main()
