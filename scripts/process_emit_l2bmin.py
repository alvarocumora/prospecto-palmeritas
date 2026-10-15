"""Ortorrectifica EMIT L2B MIN (NASA) con la GLT oficial y recorta al AOI de Cholqui.

Uso: python scripts/process_emit_l2bmin.py <dir_con_nc> <salida_cruda.json> <salida_visor.json> [w s e n]
AOI por defecto: Cholqui. Los Verdes: -71.157 -32.070 -71.071 -31.994 (proyecto integrado + ~500 m).
Sin interpolación ni relleno: cada celda de salida es un píxel EMIT referenciado por la GLT
(vecino más cercano oficial). Píxeles con fill, banda nula o incertidumbre >= profundidad se descartan.
"""
import sys, json, hashlib, glob, os
import numpy as np, h5py

AOI = (-71.098, -33.900, -70.997, -33.809)  # geocapitals-remote/configs/cholqui_aoi.yaml
MIN_DEPTH = 0.02  # profundidad de banda mínima (adimensional)

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''): h.update(b)
    return h.hexdigest()

def ortho(arr, gx, gy, fill):
    out = np.full(gx.shape, fill, dtype=arr.dtype)
    v = (gx > 0) & (gy > 0)
    out[v] = arr[gy[v] - 1, gx[v] - 1]
    return out

def process(min_path, unc_path):
    global AOI
    f = h5py.File(min_path); u = h5py.File(unc_path)
    gt = f.attrs['geotransform']; gx = f['location/glt_x'][:]; gy = f['location/glt_y'][:]
    x0, dx, y0, dy = gt[0], gt[1], gt[3], gt[5]
    c0 = int(np.floor((AOI[0] - x0) / dx)); c1 = int(np.ceil((AOI[2] - x0) / dx))
    r0 = int(np.floor((AOI[3] - y0) / dy)); r1 = int(np.ceil((AOI[1] - y0) / dy))
    gx, gy = gx[r0:r1, c0:c1], gy[r0:r1, c0:c1]
    names = [n.decode() if isinstance(n, bytes) else str(n) for n in f['mineral_metadata/name'][:]]
    uk = list(u.keys())
    feats, stats, covered = [], {}, int(((gx > 0) & (gy > 0)).sum())
    for g in (1, 2):
        mid = ortho(f[f'group_{g}_mineral_id'][:], gx, gy, -9999)
        dep = ortho(f[f'group_{g}_band_depth'][:], gx, gy, -9999.0)
        ukey = next((k for k in uk if k.startswith(f'group_{g}') and 'depth' in k), None)
        unc = ortho(u[ukey][:], gx, gy, -9999.0) if ukey else np.full(dep.shape, np.nan)
        ok = (mid > 0) & (dep >= MIN_DEPTH) & (unc >= 0) & (unc < dep)
        for r, c in zip(*np.nonzero(ok)):
            lon = x0 + (c0 + c) * dx; lat = y0 + (r0 + r) * dy
            name = names[int(mid[r, c])]
            stats[name] = stats.get(name, 0) + 1
            feats.append({'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': [[
                [round(lon, 6), round(lat, 6)], [round(lon + dx, 6), round(lat, 6)],
                [round(lon + dx, 6), round(lat + dy, 6)], [round(lon, 6), round(lat + dy, 6)],
                [round(lon, 6), round(lat, 6)]]]},
                'properties': {'mineral': name, 'grupo': g, 'profundidad_banda': round(float(dep[r, c]), 4),
                               'incertidumbre': round(float(unc[r, c]), 4)}})
    return feats, stats, covered, int(gx.size), ukey is not None

def main(d, out):
    scenes, all_feats = [], []
    for mp in sorted(glob.glob(os.path.join(d, 'EMIT_L2B_MIN_002_*.nc'))):
        sid = os.path.basename(mp)[:-3]; up = mp.replace('_MIN_', '_MINUNCERT_')
        feats, stats, cov, tot, hasu = process(mp, up)
        for ft in feats: ft['properties']['escena'] = sid
        all_feats += feats
        scenes.append({'id': sid, 'adquisicion': sid.split('_')[-1], 'sha256': sha(mp),
                       'sha256_incertidumbre': sha(up), 'pixeles_aoi_cubiertos': cov, 'pixeles_aoi': tot,
                       'detecciones': len(feats), 'por_mineral': stats, 'incertidumbre_aplicada': hasu})
    json.dump({'type': 'FeatureCollection', 'metadata': {
        'producto': 'NASA EMIT L2B MIN v002 (EMITL2BMIN_002)', 'proveedor': 'NASA LP DAAC',
        'evidencia': 'MODELADO', 'ortorrectificacion': 'GLT oficial NASA (glt_x/glt_y), vecino más cercano, sin interpolación',
        'crs': 'EPSG:4326', 'resolucion_grados': 0.000542232520, 'aoi': AOI,
        'filtro': f'mineral_id>0, profundidad_banda>={MIN_DEPTH}, 0<=incertidumbre<profundidad',
        'aviso': 'Estimación mineral espectral de superficie (NASA EMIT). No es medición de terreno, ensaye ni recurso.',
        'escenas': scenes}, 'features': all_feats}, open(out, 'w'), separators=(',', ':'), ensure_ascii=False)
    print(json.dumps(scenes, indent=1, ensure_ascii=False)); print('bytes', os.path.getsize(out))


# ---- Compactación para el visor: familias minerales, una celda = un punto (centro de píxel GLT) ----
FAMILIES = [
    ('alunita', 'Alunita / sulfatos ácidos (argílica avanzada)', ('alun', 'jarosite')),
    ('arcillas', 'Caolinita / esmectita (argílica)', ('kaol', 'smectite', 'pyroph')),
    ('clorita', 'Clorita / serpentina / talco (propilítica)', ('chlorite', 'serpentine', 'talc', 'actinolite', 'epidote')),
    ('carbonatos', 'Carbonatos / yeso', ('carbonate', 'gypsum', 'calcite')),
    ('oxidos', 'Óxidos de Fe³⁺ (hematita / goethita)', ('fe3+', 'hematite', 'goeth', 'ferrihydrite')),
]

def family(name):
    n = name.lower()
    for key, _, pats in FAMILIES:
        if any(p in n for p in pats): return key
    return None

def compact(src, out):
    fc = json.load(open(src)); cells = {}
    for ft in fc['features']:
        p = ft['properties']; fam = family(p['mineral'])
        if not fam: continue
        ring = ft['geometry']['coordinates'][0]
        lon = round((ring[0][0] + ring[2][0]) / 2, 6); lat = round((ring[0][1] + ring[2][1]) / 2, 6)
        k = (fam, lon, lat); scene = p['escena'][-15:-7]
        c = cells.setdefault(k, {'f': fam, 'm': p['mineral'], 'd': p['profundidad_banda'], 'u': p['incertidumbre'], 's': set()})
        c['s'].add(scene)
        if p['profundidad_banda'] > c['d']: c.update(m=p['mineral'], d=p['profundidad_banda'], u=p['incertidumbre'])
    feats = [{'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [k[1], k[2]]},
              'properties': {'familia': c['f'], 'mineral': c['m'], 'profundidad_banda': c['d'], 'incertidumbre': c['u'],
                             'escenas': ','.join(sorted(c['s'])), 'coincide_2_escenas': len(c['s']) > 1}}
             for k, c in cells.items()]
    meta = fc['metadata']; meta['familias'] = {k: l for k, l, _ in FAMILIES}
    meta['geometria'] = 'Punto en el centro de cada píxel EMIT ortorrectificado (~60 m); una celda puede aparecer en ambas escenas.'
    meta['conteo_familias'] = {k: sum(1 for f in feats if f['properties']['familia'] == k) for k, _, _ in FAMILIES}
    feats = [f for f in feats if f['properties']['familia'] != 'oxidos' or f['properties']['coincide_2_escenas'] or len(meta['escenas']) < 2]
    meta['filtro_oxidos'] = 'Óxidos de Fe³⁺: solo celdas detectadas en ambas escenas, por su ubicuidad en suelos.'
    meta['conteo_familias'] = {k: sum(1 for f in feats if f['properties']['familia'] == k) for k, _, _ in FAMILIES}
    json.dump({'type': 'FeatureCollection', 'metadata': meta, 'features': feats}, open(out, 'w'), separators=(',', ':'), ensure_ascii=False)
    print(meta['conteo_familias'], 'coinciden', sum(f['properties']['coincide_2_escenas'] for f in feats), 'bytes', os.path.getsize(out))

if __name__ == '__main__':
    if len(sys.argv) >= 8: AOI = tuple(float(v) for v in sys.argv[4:8])
    main(sys.argv[1], sys.argv[2])
    compact(sys.argv[2], sys.argv[3])
