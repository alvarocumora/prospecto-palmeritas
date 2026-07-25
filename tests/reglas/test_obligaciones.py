"""B6 · Tests de la lógica pura de obligaciones/alertas."""
import importlib.util
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("obligaciones", ROOT / "packages" / "reglas" / "obligaciones.py")
ob = importlib.util.module_from_spec(_spec)
sys.modules["obligaciones"] = ob
_spec.loader.exec_module(ob)


def test_umbrales_escalonados():
    assert ob.alertas_a_disparar(100, set()) == []
    assert ob.alertas_a_disparar(90, set()) == ["d90"]
    assert ob.alertas_a_disparar(30, {"d90"}) == ["d30"]
    assert ob.alertas_a_disparar(5, {"d90", "d30"}) == ["d7"]
    # Catch-up: primera corrida a 5 días dispara los tres.
    assert ob.alertas_a_disparar(5, set()) == ["d90", "d30", "d7"]


def test_vencido_una_sola_vez():
    assert ob.alertas_a_disparar(-1, {"d90", "d30", "d7"}) == ["vencido"]
    assert ob.alertas_a_disparar(-5, {"d90", "d30", "d7", "vencido"}) == []


def test_idempotencia_por_umbral():
    assert ob.alertas_a_disparar(90, {"d90"}) == []
    assert ob.alertas_a_disparar(7, {"d90", "d30", "d7"}) == []


def test_periodo_patente():
    p, v = ob.periodo_patente(date(2026, 1, 10))
    assert p == "2026" and v == date(2026, 3, 31)
    # Pasado el 31-mar, la próxima obligación es del año siguiente.
    p2, v2 = ob.periodo_patente(date(2026, 6, 1))
    assert p2 == "2027" and v2 == date(2027, 3, 31)
