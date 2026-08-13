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


def fino_por_escenario(toneladas: float, leyes_gpt: list[float]) -> list[dict]:
    """Calcula el fino (g y oz troy) por escenario de ley. Cálculo, no ensaye."""
    out = []
    for g in leyes_gpt:
        gramos = float(toneladas) * 1000.0 * float(g)
        oz = gramos / TROY_OZ_G
        out.append({
            "ley_gpt": g,
            "gramos": round(gramos, 0),
            "kg": round(gramos / 1000.0, 2),
            "oz_troy": round(oz, 1),
        })
    return out


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
    try:
        out = subprocess.run(["pdfinfo", str(pdf_path)], capture_output=True, text=True)
        for line in out.stdout.splitlines():
            if line.lower().startswith("pages:"):
                return int(line.split(":")[1].strip())
    except FileNotFoundError:
        pass
    return -1


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


def build_ficha(yml_path: Path) -> Path:
    data = yaml.safe_load(yml_path.read_text(encoding="utf-8"))
    env = jinja_env()
    tpl = env.get_template("ficha_oferta.html")

    toneladas = (data.get("cantidad") or {}).get("toneladas")
    leyes = data.get("escenarios_ley_gpt") or []
    fino = fino_por_escenario(toneladas, leyes) if (toneladas and leyes) else []

    ctx = {
        "org_name": ORG_NAME,
        "tagline": ORG_TAGLINE_ES,
        "css": css_inline(),
        "logo": logo_ref(),
        "d": data,
        "fino": fino,
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

    sub.add_parser("all", help="KYC (es) + ficha del YAML de ejemplo")

    args = ap.parse_args()

    if args.cmd == "kyc":
        pdf = build_kyc(args.lang)
        print(f"[kyc]   {pdf}  ->  {pdf_page_count(pdf)} páginas")
    elif args.cmd == "ficha":
        pdf = build_ficha(args.yml)
        print(f"[ficha] {pdf}  ->  {pdf_page_count(pdf)} páginas")
    elif args.cmd == "all":
        k = build_kyc("es")
        print(f"[kyc]   {k}  ->  {pdf_page_count(k)} páginas")
        f = build_ficha(ROOT / "data" / "au_conc_202608.yml")
        print(f"[ficha] {f}  ->  {pdf_page_count(f)} páginas")


if __name__ == "__main__":
    main()
