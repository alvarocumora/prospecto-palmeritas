"""B5.3 · Tests del motor de prospectividad REE.

Verifican el ETIQUETADO obligatorio (Ley 20.235), la transparencia del score
(cada componente reporta su aporte), la no-invención de datos faltantes y la
propagación de "no verificado".
"""
import importlib.util
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location(
    "prospectividad", ROOT / "packages" / "reglas" / "prospectividad.py"
)
pr = importlib.util.module_from_spec(_spec)
sys.modules["prospectividad"] = pr
_spec.loader.exec_module(pr)


def _reglas(verificado=False):
    fecha = "2026-07-01" if verificado else None
    R = pr.Regla
    return pr.Reglas(
        pesos={
            "litologia": R("peso", "litologia", 0.5, fecha),
            "contacto": R("peso", "contacto", 0.3, fecha),
            "pendiente": R("peso", "pendiente", 0.2, fecha),
        },
        litologia={
            "granitoide_tipo_i": R("litologia", "granitoide_tipo_i", 1.0, fecha),
            "sedimentaria": R("litologia", "sedimentaria", 0.05, fecha),
        },
        params={
            "distancia_contacto_optima_m": R("param", "distancia_contacto_optima_m", 500, fecha),
            "distancia_contacto_max_m": R("param", "distancia_contacto_max_m", 3000, fecha),
            "pendiente_optima_max_grados": R("param", "pendiente_optima_max_grados", 8, fecha),
            "pendiente_max_grados": R("param", "pendiente_max_grados", 25, fecha),
        },
    )


def _celda(**kw):
    base = dict(cell_lat=-27.4, cell_lng=-70.3, cell_size_m=250)
    base.update(kw)
    return pr.FactoresCelda(**base)


def test_etiqueta_obligatoria_en_cada_celda():
    assert pr.ETIQUETA == "priorización exploratoria, no estimación de recursos"
    reglas = _reglas()
    factores = [
        _celda(litologia_clase="granitoide_tipo_i", distancia_contacto_m=100, pendiente_grados=5),
        _celda(litologia_clase="sedimentaria", distancia_contacto_m=5000, pendiente_grados=40),
        _celda(),  # sin datos
    ]
    for c in pr.puntuar_grilla(factores, reglas):
        reg = pr.a_registro_celda(c)
        assert reg["features"]["etiqueta"] == pr.ETIQUETA
        assert c.etiqueta == pr.ETIQUETA
        # Nunca se presenta como estimación de recurso.
        assert "estimación de recursos" in reg["features"]["etiqueta"]
        assert reg["features"]["etiqueta"].startswith("priorización exploratoria")


def test_celda_muy_favorable_score_alto():
    reglas = _reglas()
    c = pr.puntuar_celda(
        _celda(litologia_clase="granitoide_tipo_i", distancia_contacto_m=200, pendiente_grados=3),
        reglas,
    )
    # litología 1.0, contacto 1.0 (<=500), pendiente 1.0 (<=8) => 100.
    assert c.score == pytest.approx(100.0)


def test_celda_desfavorable_score_bajo():
    reglas = _reglas()
    c = pr.puntuar_celda(
        _celda(litologia_clase="sedimentaria", distancia_contacto_m=5000, pendiente_grados=40),
        reglas,
    )
    # litología 0.05*0.5=0.025 => 2.5; contacto 0; pendiente 0.
    assert c.score == pytest.approx(2.5)


def test_cada_componente_reporta_su_aporte():
    reglas = _reglas()
    c = pr.puntuar_celda(
        _celda(litologia_clase="granitoide_tipo_i", distancia_contacto_m=200, pendiente_grados=3),
        reglas,
    )
    factores = {cp.factor for cp in c.componentes}
    assert factores == {"litologia", "contacto", "pendiente"}
    # El score es exactamente la suma de aportes * 100.
    assert c.score == pytest.approx(100.0 * sum(cp.aporte for cp in c.componentes))
    reg = pr.a_registro_celda(c)
    assert set(reg["features"]["aporte"].keys()) == factores


def test_dato_faltante_no_se_rellena():
    reglas = _reglas()
    c = pr.puntuar_celda(_celda(), reglas)  # sin litología/contacto/pendiente
    assert c.score == pytest.approx(0.0)
    assert "litologia_ausente" in c.flags
    assert "sin_dato_contacto" in c.flags
    assert "sin_dato_pendiente" in c.flags
    # Componentes en 0, no un default verosímil.
    for cp in c.componentes:
        assert cp.favorabilidad == 0.0


def test_litologia_desconocida_marca_flag():
    reglas = _reglas()
    c = pr.puntuar_celda(_celda(litologia_clase="clase_inexistente",
                                distancia_contacto_m=100, pendiente_grados=3), reglas)
    lit = next(cp for cp in c.componentes if cp.factor == "litologia")
    assert lit.favorabilidad == 0.0 and "litologia_desconocida" in lit.flags


def test_no_verificado_se_propaga():
    # Con reglas sin fecha_verificacion, toda celda sale no_verificado.
    c = pr.puntuar_celda(
        _celda(litologia_clase="granitoide_tipo_i", distancia_contacto_m=200, pendiente_grados=3),
        _reglas(verificado=False),
    )
    assert c.no_verificado is True
    assert pr.a_registro_celda(c)["features"]["no_verificado"] is True
    # Verificadas => no_verificado False.
    c2 = pr.puntuar_celda(
        _celda(litologia_clase="granitoide_tipo_i", distancia_contacto_m=200, pendiente_grados=3),
        _reglas(verificado=True),
    )
    assert c2.no_verificado is False


def test_score_siempre_en_rango():
    reglas = _reglas()
    import itertools
    for lit, dist, pen in itertools.product(
        [None, "granitoide_tipo_i", "sedimentaria", "otra"], [None, 0, 800, 5000], [None, 0, 15, 90]
    ):
        c = pr.puntuar_celda(_celda(litologia_clase=lit, distancia_contacto_m=dist,
                                    pendiente_grados=pen), reglas)
        assert 0.0 <= c.score <= 100.0


def test_registro_celda_calza_contrato_lovable():
    reglas = _reglas()
    c = pr.puntuar_celda(
        _celda(litologia_clase="granitoide_tipo_i", distancia_contacto_m=200, pendiente_grados=3),
        reglas,
    )
    reg = pr.a_registro_celda(c)
    assert set(reg.keys()) == {"cell_lat", "cell_lng", "cell_size_m", "score", "features"}
    assert 0 <= reg["score"] <= 100
    assert reg["features"]["modelo"] == "ree_arcilla_ionica"


# --- Contra PostGIS: cargar las reglas seed desde la tabla y puntuar. ---
def test_cargar_reglas_desde_db_y_puntuar():
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("sin DATABASE_URL — se corre en CI con el service container")
    psycopg = pytest.importorskip("psycopg")
    mig = ROOT / "supabase/migrations/20260725010000_b5_prospectividad.sql"
    with psycopg.connect(url, autocommit=True) as conn, conn.cursor() as cur:
        for role in ("authenticated", "service_role"):
            cur.execute("DO $$ BEGIN CREATE ROLE %s; EXCEPTION WHEN duplicate_object THEN NULL; END $$" % role)
        cur.execute("DROP TABLE IF EXISTS public.reglas_prospectividad CASCADE")
        cur.execute(mig.read_text())
        reglas = pr.cargar_reglas(cur)
        assert reglas.pesos["litologia"].valor == 0.5
        assert reglas.litologia["granitoide_tipo_i"].valor == 1.0
        # Seed sin fecha_verificacion => no verificado.
        assert reglas.pesos["litologia"].verificado is False
        c = pr.puntuar_celda(
            _celda(litologia_clase="granitoide_tipo_i", distancia_contacto_m=200, pendiente_grados=3),
            reglas,
        )
        assert c.score == pytest.approx(100.0)
        assert c.no_verificado is True
