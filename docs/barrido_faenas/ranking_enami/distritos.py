import json,pickle,csv,numpy as np,collections
from shapely.geometry import Point,MultiPoint,box,Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely import affinity
from sklearn.cluster import DBSCAN
from pyproj import Transformer
tr=Transformer.from_crs(32719,4326,always_xy=True)
L=pickle.load(open('rk/todo.pkl','rb'))
def ha(x): return x['ha'] if x['ha'] else x['g'].area/1e4
EX=[x for x in L if x['tipo']=='EXPLOTACION']
small=[x for x in EX if ha(x)<=60]
P=np.array([[x['g'].centroid.x,x['g'].centroid.y] for x in small])
lab=DBSCAN(eps=1000,min_samples=5).fit(P).labels_
nxt=lab.max()+1
for k in range(lab.max()+1):
  idx=np.where(lab==k)[0]
  if len(idx)>70:
    sub=DBSCAN(eps=450,min_samples=5).fit(P[idx]).labels_
    for j in range(sub.max()+1):
      lab[idx[sub==j]]=nxt; nxt+=1
    lab[idx[sub<0]]=-1
ks=sorted(set(lab)-{-1}); remap={k:i for i,k in enumerate(ks)}; lab=np.array([remap.get(l,-1) for l in lab])
print('clusters',lab.max()+1,'noise',(lab<0).sum())
VIG=[x for x in L if x['sit']!='ELIMINADA']; TV=STRtree([x['g'] for x in VIG])
TEX=STRtree([x['g'] for x in EX])
# propias (PSAD -> visor)
exec(open('nuevas/base.py').read().split("E=json.load")[0].replace("C=pickle.load(open('cat_1811.pkl','rb')); L=pickle.load(open('elim.pkl','rb'))","").replace("Z=pickle.load(open('zona/cat_zona.pkl','rb'))","").replace("VIG=[r['g'] for r in C]+[sh(f['g']) for f in Z if f['sit']!='ELIMINADA']","").replace("EXP=[(r['n'],r['g'],r['attrs'].get('HECTAREAS') or r['g'].area/1e4) for r in L if r['tipo']=='EXPLOTACION']","").replace("EXP+=[(f['n'],sh(f['g']),f['ha'] or f['g'].area/1e4) for f in Z if f['sit']=='ELIMINADA' and f['tipo']=='EXPLOTACION']",""))
E=json.load(open('paq/esc.json')); OWN={}
for k,x in E.items(): OWN[k]=affinity.translate(Polygon(x['V']),-200,-325)
for f in ['sur/piezas.json','chele/piezas.json','pet/piezas.json','nuevas/piezas.json']:
  for x in json.load(open(f)): OWN[x['nombre']]=box(x['E0']-200,x['N0']-325,x['E1']-200,x['N1']-325)
OWNU=unary_union(list(OWN.values()))
# satélite
SAT=[]
for r in csv.DictReader(open('/home/claude/prospecto-palmeritas/docs/barrido_faenas/barrido_faenas_eliminadas.csv')):
  e,n=float(r['E']),float(r['N'])
  if 'PSAD' in r['datum']: e,n=e-200,n-325
  SAT.append((r['cat'],r['nombre'],e,n))
for r in csv.DictReader(open('/home/claude/prospecto-palmeritas/docs/barrido_faenas/costa_v/barrido_costa_v.csv')):
  SAT.append((r['cat'],r['minas_eliminadas'].split(';')[0],float(r['E_wgs']),float(r['N_wgs'])))
D=[]
for k in range(lab.max()+1):
  mem=[small[i] for i in np.where(lab==k)[0]]
  hull=MultiPoint([m['g'].centroid for m in mem]).convex_hull.buffer(600)
  ex=[EX[i] for i in TEX.query(hull) if EX[i]['g'].intersects(hull)]
  elim=[x for x in ex if x['sit']=='ELIMINADA']; vig=[x for x in ex if x['sit']!='ELIMINADA']
  occ=unary_union([VIG[i]['g'] for i in TV.query(hull) if VIG[i]['g'].intersects(hull)])
  free=hull.difference(occ)
  freeE=unary_union([x['g'] for x in elim]).intersection(free) if elim else None
  c=hull.centroid; lon,lat=tr.transform(c.x,c.y)
  coms=collections.Counter(m['com'] for m in mem).most_common(1)[0][0]
  tits=collections.Counter(x['tit'] for x in vig if x['tit']).most_common(3)
  sat=[s for s in SAT if hull.contains(Point(s[2],s[3]))]
  D.append(dict(k=k,com=coms,lon=lon,lat=lat,E=round(c.x),N=round(c.y),area_ha=round(hull.area/1e4),
    n_pirq=len(mem),n_elim=len(elim),n_vig_expl=len(vig),libre_ha=round(free.area/1e4),libre_hist_ha=round(freeE.area/1e4) if freeE else 0,
    propio_ha=round(hull.intersection(OWNU).area/1e4),satA=sum(1 for s in sat if s[0]=='A'),satB=sum(1 for s in sat if s[0]!='A'),
    sat_nombres='; '.join(sorted({s[1] for s in sat if s[0]=='A'}))[:120],
    nombres='; '.join(r for r,_ in collections.Counter(__import__('re').split(r'[ ,]+[0-9IVX]',m['n'] or '')[0].strip() for m in mem).most_common(4)),tit_vig='; '.join(f"{t} ({n})" for t,n in tits),hull=hull))
print(len(D)); pickle.dump(D,open('rk/distritos.pkl','wb'))
print(collections.Counter(d['com'] for d in D).most_common(25))
