"""Reporte HTML de Nivel 0 sobre salidas sintéticas de valor conocido.

No requiere numpy/rasterio: report.py es stdlib + jinja2. Verifica que el reporte
ensambla coverage + candidatos, refleja el veredicto y conserva los disclaimers.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from gc_remote.report import build_report, DISCLAIMER_GLOBAL  # noqa: E402


def _coverage(interp_typ, interp_best, floor=0.15):
    ok = interp_typ >= floor
    return {
        "config": "cholqui",
        "config_sha256": "abcdef0123456789abcdef",
        "aoi_center_lonlat": [-71.1234, -33.9876],
        "output_crs": "EPSG:32719",
        "scenes_candidate": 40,
        "scenes_used_for_coverage": 24,
        "verdict": {"interpretable_fraction_of_area": interp_typ, "floor": floor,
                    "spectral_conclusive": ok,
                    "headline": f"Superficie interpretable: {interp_typ*100:.1f}% del área."},
        "interpretable_typical_frac": interp_typ,
        "interpretable_bestcase_frac": interp_best,
        "coverage_typical": {"fraction_of_area": {
            "vegetation": 1 - interp_typ - 0.05, "interpretable": interp_typ,
            "water": 0.03, "cloud": 0.02, "nodata": 0.0}},
        "coverage_bestcase": {"fraction_of_area": {}},
    }


def _candidates():
    return {"type": "FeatureCollection", "name": "sampling_candidates",
            "metadata": {"primary_index": "aloh", "n_candidates": 2,
                         "disclaimer": "Candidato de muestreo. Anomalía SWIR Al-OH. NO es mineral."},
            "features": [
                {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-71.12, -33.98]},
                 "properties": {"rank": 1, "aloh_zscore": 3.42, "aloh_percentile": 99.1,
                                "easting": 305123.0, "northing": 6254321.0}},
                {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-71.13, -33.99]},
                 "properties": {"rank": 2, "aloh_zscore": 2.88, "aloh_percentile": 97.3,
                                "easting": 306000.0, "northing": 6255000.0}},
            ]}


def test_reporte_conclusivo_con_candidatos(tmp_path):
    (tmp_path / "coverage.json").write_text(json.dumps(_coverage(0.42, 0.80)))
    (tmp_path / "sampling_candidates.geojson").write_text(json.dumps(_candidates()))
    out = build_report(tmp_path / "coverage.json",
                       tmp_path / "sampling_candidates.geojson",
                       tmp_path / "r.html", prospecto="Cholqui")
    html = out.read_text()
    assert "ESPECTRAL APLICABLE" in html
    assert "42.0%" in html and "80.0%" in html          # típico y mejor caso
    assert "3.42" in html and "99.1" in html            # candidato rankeado
    assert "2 candidato" in html                         # scorecard
    assert DISCLAIMER_GLOBAL[:30] in html
    assert "no separa roca de suelo" in html


def test_reporte_no_concluyente(tmp_path):
    (tmp_path / "coverage.json").write_text(json.dumps(_coverage(0.08, 0.20)))
    out = build_report(tmp_path / "coverage.json", None, tmp_path / "r.html")
    html = out.read_text()
    assert "ESPECTRAL NO CONCLUYENTE" in html
    assert "ESTRUCTURAL" in html                          # scorecard redirige a estructura
    assert "Sin candidatos" in html
