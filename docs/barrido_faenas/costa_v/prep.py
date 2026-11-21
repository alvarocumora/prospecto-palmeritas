import json,pickle
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree
prev={c['rol'] for c in json.load(open('chips.json'))}
allf=[]
for z in ['costa_iv','v_norte']:
  for f in json.load(open(f'zona/catastro_{z}.json')):
    if not f['rings']: continue
    try: g=Polygon(f['rings'][0],f['rings'][1:]).buffer(0)
    except Exception: continue
    if g.is_empty: continue
    f['g']=g; f['zona']=z; allf.append(f)
# dedupe by rol+name
seen={};
for f in allf: seen[(f['rol'],f['n'])]=f
allf=list(seen.values())
vig=[f for f in allf if f['sit']!='ELIMINADA']
pickle.dump(allf,open('zona/cat_zona.pkl','wb'))
T=STRtree([f['g'] for f in vig])
out=[]
for f in allf:
  if f['sit']!='ELIMINADA' or f['tipo']!='EXPLOTACION' or f['rol'] in prev: continue
  idx=T.query(f['g'])
  occ=[vig[i]['g'] for i in idx if vig[i]['g'].intersects(f['g'])]
  free=f['g'].difference(unary_union(occ)) if occ else f['g']
  if free.area<5e4: continue
  # biggest free part
  parts=sorted(getattr(free,'geoms',[free]),key=lambda p:-p.area)
  p=parts[0].representative_point()
  # center chip on centroid of largest part if small, else on rep point
  out.append(dict(n=f['n'],rol=f['rol'],tit=f['tit'],com=f['com'],ha=f['ha'],libre=round(free.area/1e4,1),frame='wgs',E=round(p.x),N=round(p.y),zona=f['zona'],venc=f['venc']))
import collections
print(len(out),collections.Counter(o['com'] for o in out))
print(collections.Counter(o['zona'] for o in out))
out.sort(key=lambda o:(o['zona'],o['com'] or '',-o['libre']))
json.dump(out,open('zona/cand.json','w'),ensure_ascii=False)
