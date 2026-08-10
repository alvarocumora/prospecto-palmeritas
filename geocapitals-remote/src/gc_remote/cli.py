"""CLI (typer). `coverage` primero, siempre: si el área no es observable, no gastar el resto."""
from __future__ import annotations

import json
from pathlib import Path

import typer

from .config import Config
from . import coverage as cov

app = typer.Typer(add_completion=False, help="GeoCapitals Nivel 0 — screening satelital.")


@app.command()
def coverage(config: str, out: str = "./out", max_scenes: int = 24, floor: float = 0.15):
    """Máscara de cobertura multiclase (rápido y barato). Reporta la fracción interpretable."""
    cfg = Config.from_yaml(config)
    out_dir = Path(out) / cfg.name
    r = cov.run_coverage(cfg, out_dir, max_scenes=max_scenes, floor=floor)
    typer.echo(r["verdict"]["headline"])
    typer.echo(f"  típico (persistente): {r['interpretable_typical_frac']*100:.1f}%  ·  "
               f"mejor caso (fin de verano): {r['interpretable_bestcase_frac']*100:.1f}%")
    typer.echo(f"  -> {out_dir}/coverage.json")


@app.command()
def run(config: str, out: str = "./out"):
    """Pipeline completo (pendiente: índices/estructura/catastro/reporte)."""
    raise typer.Exit(typer.echo("run: pendiente — ver orden de trabajo. Corre 'coverage' primero."))


@app.command()
def validate(config: str):
    """Solo valida el config (CRS estricto + sanity del bbox)."""
    cfg = Config.from_yaml(config)
    typer.echo(json.dumps({"name": cfg.name, "aoi_center_lonlat": list(cfg.aoi.lonlat_center()),
                           "output_crs": cfg.output_crs, "config_sha256": cfg.config_sha256[:12]}, ensure_ascii=False))




@app.command()
def candidates(config: str, out: str = "./out", max_scenes: int = 18,
               percentile: float = 97.0, max_n: int = 20):
    """Candidatos de MUESTREO (no validacion): anomalia Al-OH sobre superficie interpretable."""
    from . import targets
    cfg = Config.from_yaml(config)
    out_dir = Path(out) / cfg.name
    fc = targets.run_candidates(cfg, out_dir, max_scenes=max_scenes, percentile=percentile, max_n=max_n)
    typer.echo(f"{fc['metadata']['n_candidates']} candidatos -> {out_dir}/sampling_candidates.geojson")
    typer.echo("  " + fc["metadata"]["disclaimer"])


if __name__ == "__main__":
    app()
