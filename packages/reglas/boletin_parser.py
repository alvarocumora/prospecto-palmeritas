"""B3 · Parser puro del Boletín Oficial de Minería (sin red, testeable en CI).

Recibe TEXTO ya extraído (la extracción PDF + OCR de respaldo vive en el job,
etl/boletin_job.py, con sus dependencias declaradas). Separa el texto en
registros, extrae campos por etiquetas, transforma las coordenadas PSAD56→WGS84
con el mismo juego que el catastro oficial (EPSG:1204, ver docs/datums.md) y le
asigna a cada registro una CONFIANZA en [0,1].

Reglas v2 aplicadas aquí:
- Un registro sin coordenadas VÁLIDAS o sin huso no se geolocaliza: geom queda
  None. NUNCA se inventa una ubicación verosímil.
- Confianza < umbral → el registro va a la cola de revisión humana; no genera
  alerta "firme".

IMPORTANTE (supuesto declarado, no verificado): el formato exacto del boletín
(etiquetas, separador de registros) NO está confirmado contra una edición real.
Aquí se asume un bloque por registro con líneas "CAMPO: valor". Cuando se
confirme el formato real, ajustar SEP_REGISTRO y los patrones de CAMPOS. Ver
docs/boletin.md.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

from pyproj import CRS, Transformer

# EPSG:1204 — mismo towgs84 que usa SERNAGEOMIN, verificado a 0.000 m contra su
# FeatureServer (ver docs/datums.md). No inventar otro juego.
SNGM_TOWGS84 = "-288,175,-376"
_WGS84 = CRS.from_epsg(4326)

# Umbral de auto-aprobación: por encima, el registro se marca 'auto_ok'; por
# debajo va a la cola de revisión humana. Configurable.
UMBRAL_AUTO = 0.75

# Rangos plausibles de UTM en Chile (PSAD56, hemisferio sur). Fuera de esto, la
# coordenada se marca inválida y el registro NO se geolocaliza.
ESTE_MIN, ESTE_MAX = 90_000.0, 910_000.0
NORTE_MIN, NORTE_MAX = 5_600_000.0, 7_720_000.0

# Pesos de la confianza (suman 1.0). Editables.
PESOS = {
    "tipo_acto": 0.20,
    "rol": 0.15,
    "coords_validas": 0.30,
    "huso": 0.10,
    "comuna": 0.10,
    "titular": 0.15,
}

SEP_REGISTRO = re.compile(r"\n\s*(?:-{3,}|={3,}|\*{3,})\s*\n")

_TIPOS = {
    "pedimento": "pedimento",
    "manifestacion": "manifestacion",
    "mensura": "mensura",
    "sentencia": "sentencia",
}


@dataclass
class RegistroBoletin:
    tipo_acto: Optional[str] = None
    rol: Optional[str] = None
    nombre: Optional[str] = None
    titular: Optional[str] = None
    comuna: Optional[str] = None
    este_psad56: Optional[float] = None
    norte_psad56: Optional[float] = None
    huso: Optional[int] = None
    lon: Optional[float] = None
    lat: Optional[float] = None
    confianza: float = 0.0
    flags: list[str] = field(default_factory=list)
    origen_hash: str = ""

    @property
    def geolocalizable(self) -> bool:
        return self.lon is not None and self.lat is not None

    @property
    def estado_revision(self) -> str:
        return "auto_ok" if self.confianza >= UMBRAL_AUTO and self.geolocalizable else "pendiente_revision"


def _sin_acentos(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _num(raw: str) -> Optional[float]:
    """Normaliza un número chileno: '351.234,56' → 351234.56. None si no parsea."""
    s = raw.strip().replace(" ", "")
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _pares_kv(bloque: str) -> list[tuple[str, str]]:
    """Divide el bloque en (clave_normalizada, valor_original) por línea.

    La clave se normaliza (sin acentos, minúscula) SOLO para matchear etiquetas;
    el valor se devuelve tal cual viene, conservando acentos ('Copiapó').
    """
    pares: list[tuple[str, str]] = []
    for linea in bloque.splitlines():
        m = re.match(r"\s*([^:\-]+?)\s*[:\-]\s*(.+?)\s*$", linea)
        if m:
            pares.append((_sin_acentos(m.group(1)).lower(), m.group(2).strip()))
    return pares


def _campo(pares: list[tuple[str, str]], etiquetas: list[str]) -> Optional[str]:
    for et in etiquetas:
        pat = re.compile(rf"^{et}$", re.I)
        for clave, valor in pares:
            if pat.match(clave) and valor:
                return valor
    return None


def _detectar_tipo(pares: list[tuple[str, str]], bloque_norm: str) -> Optional[str]:
    # Etiqueta explícita primero; luego palabra clave en el texto normalizado.
    et = _campo(pares, [r"tipo(?:\s+de\s+acto)?", r"acto", r"tipo\s+de\s+concesion"])
    fuente = (_sin_acentos(et).lower() if et else bloque_norm.lower())
    for clave, canon in _TIPOS.items():
        if clave in fuente:
            return canon
    return None


def psad56_utm_a_wgs84(este: float, norte: float, huso: int) -> tuple[float, float]:
    """PSAD56 UTM (huso 18/19 S) → WGS84 (lon, lat) con EPSG:1204."""
    crs = CRS.from_proj4(
        f"+proj=utm +zone={huso} +south +ellps=intl +towgs84={SNGM_TOWGS84} +units=m +no_defs"
    )
    t = Transformer.from_crs(crs, _WGS84, always_xy=True)
    lon, lat = t.transform(este, norte)
    return (lon, lat)


def _hash_registro(r: RegistroBoletin) -> str:
    clave = "|".join(str(x) for x in (
        r.tipo_acto, r.rol, r.nombre, r.titular, r.comuna,
        r.este_psad56, r.norte_psad56, r.huso,
    ))
    return hashlib.sha256(clave.encode("utf-8")).hexdigest()


def parsear_registro(bloque: str) -> RegistroBoletin:
    norm = _sin_acentos(bloque)
    pares = _pares_kv(bloque)
    r = RegistroBoletin()
    r.tipo_acto = _detectar_tipo(pares, norm)
    r.rol = _campo(pares, [r"rol"])
    r.nombre = _campo(pares, [r"nombre"])
    r.titular = _campo(pares, [r"titular", r"solicitante", r"peticionario"])
    r.comuna = _campo(pares, [r"comuna"])

    este_raw = _campo(pares, [r"este", r"utm\s+este", r"coordenada\s+este", r"e"])
    norte_raw = _campo(pares, [r"norte", r"utm\s+norte", r"coordenada\s+norte", r"n"])
    huso_raw = _campo(pares, [r"huso", r"zona"])
    r.este_psad56 = _num(este_raw) if este_raw else None
    r.norte_psad56 = _num(norte_raw) if norte_raw else None
    if huso_raw:
        m = re.search(r"(18|19)", huso_raw)
        r.huso = int(m.group(1)) if m else None

    _puntuar_y_geolocalizar(r)
    r.origen_hash = _hash_registro(r)
    return r


def _coords_validas(r: RegistroBoletin) -> bool:
    return (
        r.este_psad56 is not None and ESTE_MIN <= r.este_psad56 <= ESTE_MAX
        and r.norte_psad56 is not None and NORTE_MIN <= r.norte_psad56 <= NORTE_MAX
    )


def _puntuar_y_geolocalizar(r: RegistroBoletin) -> None:
    flags: list[str] = []
    score = 0.0

    if r.tipo_acto:
        score += PESOS["tipo_acto"]
    else:
        flags.append("tipo_acto_no_reconocido")
    if r.rol:
        score += PESOS["rol"]
    else:
        flags.append("rol_ausente")
    if r.comuna:
        score += PESOS["comuna"]
    else:
        flags.append("comuna_ausente")
    if r.titular:
        score += PESOS["titular"]
    else:
        flags.append("titular_ausente")

    coords_ok = _coords_validas(r)
    if coords_ok:
        score += PESOS["coords_validas"]
    elif r.este_psad56 is None and r.norte_psad56 is None:
        flags.append("coordenadas_ausentes")
    else:
        flags.append("coordenada_fuera_de_rango")

    huso_ok = r.huso in (18, 19)
    if huso_ok:
        score += PESOS["huso"]
    else:
        flags.append("huso_ausente_o_invalido")

    # Geolocalizar SOLO con coords válidas y huso conocido. Si no, geom queda None
    # — nunca una ubicación por defecto.
    if coords_ok and huso_ok:
        r.lon, r.lat = psad56_utm_a_wgs84(r.este_psad56, r.norte_psad56, r.huso)
    else:
        flags.append("no_geolocalizable")

    r.confianza = round(score, 4)
    r.flags = flags


def parsear_boletin(texto: str) -> list[RegistroBoletin]:
    """Separa el texto en registros y parsea cada uno. Ignora bloques vacíos."""
    if not texto or not texto.strip():
        return []
    bloques = SEP_REGISTRO.split(texto.strip())
    registros = [parsear_registro(b) for b in bloques if b and b.strip()]
    # Descartar bloques que no aportan ningún campo (ruido de cabecera/pie).
    return [r for r in registros if _tiene_algun_campo(r)]


def _tiene_algun_campo(r: RegistroBoletin) -> bool:
    return any((r.tipo_acto, r.rol, r.nombre, r.titular, r.comuna,
                r.este_psad56, r.norte_psad56))
