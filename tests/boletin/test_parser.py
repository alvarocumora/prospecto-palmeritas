"""B3 · Tests del parser puro del boletín (confianza, geolocalización, cola).

Las fixtures de texto son SINTÉTICAS (un boletín inventado como caso de prueba),
NUNCA se cargan como dato real. Sirven solo para ejercer el parser.
"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location(
    "boletin_parser", ROOT / "packages" / "reglas" / "boletin_parser.py"
)
bp = importlib.util.module_from_spec(_spec)
sys.modules["boletin_parser"] = bp
_spec.loader.exec_module(bp)


REG_COMPLETO = """\
Tipo: Pedimento
Rol: 03201-1234-5
Nombre: MINA EJEMPLO 1
Titular: Compañía Minera Ejemplo SpA
Comuna: Copiapó
Este: 365.000
Norte: 6.970.000
Huso: 19
"""

REG_SIN_COORDS = """\
Tipo: Manifestacion
Rol: 03201-9999-0
Nombre: SOLO NOMBRE
Comuna: Vallenar
"""

REG_COORD_FUERA_RANGO = """\
Tipo: Pedimento
Rol: 03201-0000-1
Este: 12
Norte: 999
Huso: 19
"""


def test_registro_completo_alta_confianza_y_geolocalizado():
    r = bp.parsear_registro(REG_COMPLETO)
    assert r.tipo_acto == "pedimento"
    assert r.rol == "03201-1234-5"
    assert r.titular.startswith("Compañía")
    assert r.este_psad56 == 365000.0 and r.norte_psad56 == 6970000.0 and r.huso == 19
    assert r.geolocalizable
    # Copiapó ~ -70.3, -27.4 aprox (huso 19). Sanity de rango.
    assert -71 < r.lon < -69 and -28 < r.lat < -26
    assert r.confianza == 1.0
    assert r.estado_revision == "auto_ok"
    assert r.flags == []


def test_sin_coords_no_geolocaliza_y_va_a_revision():
    r = bp.parsear_registro(REG_SIN_COORDS)
    assert not r.geolocalizable
    assert r.lon is None and r.lat is None      # NUNCA una coordenada por defecto
    assert "coordenadas_ausentes" in r.flags
    assert r.confianza < bp.UMBRAL_AUTO
    assert r.estado_revision == "pendiente_revision"


def test_coord_fuera_de_rango_se_marca_y_no_geolocaliza():
    r = bp.parsear_registro(REG_COORD_FUERA_RANGO)
    assert not r.geolocalizable
    assert "coordenada_fuera_de_rango" in r.flags


def test_transformacion_usa_epsg_1204():
    # El towgs84 debe ser el de SERNAGEOMIN, no otro juego.
    assert bp.SNGM_TOWGS84 == "-288,175,-376"
    lon, lat = bp.psad56_utm_a_wgs84(365000.0, 6970000.0, 19)
    assert -71 < lon < -69 and -28 < lat < -26


def test_parsear_boletin_separa_registros_y_descarta_ruido():
    texto = (
        "BOLETÍN OFICIAL DE MINERÍA - EDICIÓN DE PRUEBA\n"
        "---\n" + REG_COMPLETO + "\n---\n" + REG_SIN_COORDS + "\n---\n"
        "Pie de página sin campos relevantes\n"
    )
    regs = bp.parsear_boletin(texto)
    assert len(regs) == 2        # cabecera y pie descartados
    assert regs[0].geolocalizable and not regs[1].geolocalizable


def test_hash_estable_para_dedup():
    a = bp.parsear_registro(REG_COMPLETO)
    b = bp.parsear_registro(REG_COMPLETO)
    assert a.origen_hash == b.origen_hash and a.origen_hash != ""
    c = bp.parsear_registro(REG_SIN_COORDS)
    assert c.origen_hash != a.origen_hash


def test_numero_chileno_con_separadores():
    assert bp._num("6.970.000") == 6970000.0
    assert bp._num("365.000,50") == 365000.5
    assert bp._num("no-numero") is None
