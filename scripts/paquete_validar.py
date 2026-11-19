import json,pickle,collections
from shapely.geometry import box,Polygon,Point
from shapely.ops import unary_union
from shapely import affinity
from shapely.strtree import STRtree
P=json.load(open('val/piezas.json'))
CO=pickle.load(open('comunas.pkl','rb'))
def load(z,shift):
  out=[]
  for f in json.load(open(f'val/d/catastro_{z}.json')):
    if not f['rings']: continue
    try: g=Polygon(f['rings'][0],f['rings'][1:]).buffer(0)
    except Exception: continue
    if shift: g=affinity.translate(g,200,325)
    f['g']=g; out.append(f)
  return out
TP=load('tilama_petorca',True); CA=load('cerro_alto',False)
prev=set()
for r in pickle.load(open('cat_1811.pkl','rb')): prev.add(r['rol'])
for f in pickle.load(open('zona/cat_zona.pkl','rb')): prev.add(f['rol'])
for f in pickle.load(open('rk/todo.pkl','rb')): prev.add(f['rol'])
for r in pickle.load(open('ca_cat2.pkl','rb')): prev.add(r['rol'])
E=json.load(open('paq/esc.json'))
OWN={E[k]['nombre']+' ('+k+')':Polygon(E[k]['V']) for k in E}
OWN['ELARA 15 (V-328-2026)']=box(296000,6450350,299000,6451350)
res=[]
pend={p['nombre']:box(p['E0'],p['N0'],p['E1'],p['N1']) for p in P}
for p in P:
  b=pend[p['nombre']]; cat=CA if p['frame']=='wgs' else TP
  vig=[f for f in cat if f['sit']!='ELIMINADA' and f['g'].intersects(b) and f['g'].intersection(b).area>100]
  occ=unary_union([f['g'] for f in vig]) if vig else Polygon()
  sol=[(f['n'],f['sit'],f['tipo'],f['tit'],round(f['g'].intersection(b).area/1e4,1),f['rol'] not in prev) for f in vig]
  own=[(k,round(g.intersection(b).area/1e4,1)) for k,g in OWN.items() if p['frame']=='psad' and g.intersection(b).area>1e4]
  ownp=[(k,round(g.intersection(b).area/1e4,1)) for k,g in pend.items() if k!=p['nombre'] and g.intersection(b).area>1e4 and P[[q['nombre'] for q in P].index(k)]['frame']==p['frame']]
  libre=b.difference(occ)
  for k,g in OWN.items():
    if p['frame']=='psad': libre=libre.difference(g)
  pm=Point((p['E0']+p['E1'])/2,(p['N0']+p['N1'])/2)
  com=None;other=[]
  if p['frame']=='psad':
    com=[k for k,g in CO.items() if g.contains(pm)]
    other=[(k,round(g.intersection(b).area/1e4,1)) for k,g in CO.items() if g.intersection(b).area>1e4 and k not in com]
  res.append(dict(nombre=p['nombre'],grupo=p['grupo'],ha=p['ha'],libre=round(libre.area/1e4,1),tercero_ha=round(b.intersection(occ).area/1e4,1),
    solapes=sol,nuevos=[s for s in sol if s[5]],propias_presentadas=own,entre_pendientes=ownp,pm_comuna=com,otra_comuna=other))
json.dump(res,open('val/validacion.json','w'),ensure_ascii=False,indent=0,default=str)
for r in res:
  flag=[]
  if r['nuevos']: flag.append('NUEVO:'+';'.join(f"{s[0]}[{s[1]},{s[3]}]{s[4]}ha" for s in r['nuevos']))
  if r['propias_presentadas']: flag.append('PROPIA:'+str(r['propias_presentadas']))
  if r['entre_pendientes']: flag.append('PEND:'+str(r['entre_pendientes']))
  print(r['nombre'],r['ha'],'libre',r['libre'],'3ro',r['tercero_ha'],r['pm_comuna'],r['otra_comuna'],' | '.join(flag))
