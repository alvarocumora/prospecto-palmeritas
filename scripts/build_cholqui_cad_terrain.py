"""Build the declared CAD terrain (requires numpy/scipy); never extrapolate elevations.

Run from the project root: python3 scripts/build_cholqui_cad_terrain.py
Source coordinates were extracted as assumed WGS84/UTM 19S: datum is not certified.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.spatial import Delaunay

source = Path("src/data/geo/cholqui_levantamiento_cad.json")
features = json.loads(source.read_text())["contours"]["features"]
samples = {}
for feature in features:
    elevation = float(feature["properties"]["elevacion_m"])
    if not np.isfinite(elevation):
        raise ValueError("Invalid contour elevation")
    for lng, lat, *_ in feature["geometry"]["coordinates"]:
        key = (lng, lat)
        if key in samples and abs(samples[key] - elevation) > 0.01:
            raise ValueError("Conflicting contour elevations at the same position")
        samples[key] = elevation

lonlat = np.array(list(samples))
elevations = np.array(list(samples.values()))
center = (lonlat.min(axis=0) + lonlat.max(axis=0)) / 2
scale = np.array([111320 * np.cos(np.deg2rad(center[1])), 111320])
points = (lonlat - center) * scale
extent = float(np.ceil(np.ptp(points, axis=0).max() / 500) * 500)
size = 257
max_edge_m = 300
triangulation = Delaunay(points)
vertices = points[triangulation.simplices]
edges = np.linalg.norm(vertices - np.roll(vertices, 1, axis=1), axis=2).max(axis=1)
axis = np.linspace(-extent / 2, extent / 2, size)
x, y = np.meshgrid(axis, axis[::-1])
grid = np.column_stack([x.ravel(), y.ravel()])
simplex = triangulation.find_simplex(grid)
valid = simplex >= 0
valid[valid] &= edges[simplex[valid]] <= max_edge_m
indices = np.flatnonzero(valid)
transforms = triangulation.transform[simplex[valid]]
bary = np.einsum("ijk,ik->ij", transforms[:, :2], grid[valid] - transforms[:, 2])
weights = np.column_stack([bary, 1 - bary.sum(axis=1)])
values = (weights * elevations[triangulation.simplices[simplex[valid]]]).sum(axis=1)
heights = [None] * (size * size)
reference = float(np.median(elevations))
for index, value in zip(indices, values):
    heights[int(index)] = round(float(value - reference), 3)

output = {
    "source": "cad_contours", "evidence": "DERIVADO", "sourceEvidence": "DECLARADO",
    "sourceFile": source.name, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "method": "Delaunay linear interpolation; no extrapolation; maximum triangle edge 300 m",
    "sourceCrs": "EPSG:32719 (assumed during extraction; datum pending verification)",
    "verticalDatum": "Not provided by the owner; no vertical alignment with Copernicus certified",
    "contourCount": len(features), "pointCount": len(samples),
    "sourceMinElevationM": float(elevations.min()), "sourceMaxElevationM": float(elevations.max()),
    "size": size, "extentMeters": extent, "centerLng": float(center[0]), "centerLat": float(center[1]),
    "referenceElevationM": reference, "minH": round(float(values.min() - reference), 3),
    "maxH": round(float(values.max() - reference), 3), "maxTriangleEdgeM": max_edge_m,
    "validNodeCount": len(indices), "heights": heights,
}
destination = Path("src/data/geo/cholqui_cad_terrain.json")
destination.write_text(json.dumps(output, separators=(",", ":")))
print(f"{len(features)} contours; {len(indices)} supported grid nodes; {extent} m extent")