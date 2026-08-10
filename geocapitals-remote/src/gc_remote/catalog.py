"""Búsqueda STAC de Sentinel-2 L2A + manifest congelado (reproducibilidad).

Reproducibilidad real: `search` consulta STAC una vez y devuelve un MANIFEST (ids +
hrefs + fecha) que se persiste; las corridas siguientes leen el manifest y NO
re-consultan. Así "correr dos veces = mismo resultado" es cierto contra el manifest,
no contra el catálogo vivo (que cambia).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

PC_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"


def search_s2(bbox_wgs84: list[float], months: list[int], years: list[int],
              max_cloud_pct: float = 10.0, collection: str = "sentinel-2-l2a",
              limit: int = 500) -> list[dict]:
    """Devuelve items STAC (dict) filtrados por estacionalidad y nube. Requiere red."""
    from pystac_client import Client

    client = Client.open(PC_STAC)
    search = client.search(
        collections=[collection],
        bbox=bbox_wgs84,
        query={"eo:cloud_cover": {"lt": max_cloud_pct}},
        datetime=[f"{min(years)}-01-01T00:00:00Z", f"{max(years)}-12-31T23:59:59Z"],
        limit=limit,
    )
    items = list(search.items())
    # Filtro estacional (fin de verano austral) por mes y año declarado.
    keep = [it for it in items if it.datetime.month in months and it.datetime.year in years]
    keep.sort(key=lambda it: it.datetime)
    return [it.to_dict() for it in keep]


def build_manifest(items: list[dict], cfg_hash: str, cfg_name: str) -> dict:
    return {
        "config_name": cfg_name,
        "config_sha256": cfg_hash,
        "collection": "sentinel-2-l2a",
        "stac_endpoint": PC_STAC,
        "n_scenes": len(items),
        "scenes": [
            {
                "id": it["id"],
                "datetime": it["properties"].get("datetime"),
                "cloud": it["properties"].get("eo:cloud_cover"),
                "platform": it["properties"].get("platform"),
            }
            for it in items
        ],
    }


def write_manifest(manifest: dict, out_dir: str | Path) -> Path:
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    p = out / "scenes_manifest.json"
    p.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    return p


def load_manifest(out_dir: str | Path) -> Optional[dict]:
    p = Path(out_dir) / "scenes_manifest.json"
    return json.loads(p.read_text()) if p.exists() else None
