import json,pickle,csv
from shapely.ops import unary_union
from shapely import affinity
from pyproj import Transformer
chips={c['id']:c for c in json.load(open('chips.json'))}
RA=pickle.load(open('ca_cat2.pkl','rb')); L=pickle.load(open('elim.pkl','rb')); C=pickle.load(open('cat_1811.pkl','rb'))
VA=[r['g'] for r in RA if r['sit']!='ELIMINADA']; VT=[affinity.translate(r['g'],-200,-325) for r in C]
EA={(r['n'],r['rol']):r['g'] for r in RA if r['sit']=='ELIMINADA'}; ET={(r['n'],r['rol']):affinity.translate(r['g'],-200,-325) for r in L}
tr=Transformer.from_crs(32719,4326,always_xy=True)
R={
'A':{'CA019':'Camino en zigzag y plataforma de faena','CA023':'Red de huellas que suben a labores','CA026':'Rajos/piques, desmontes y huellas','CA033':'Red de huellas en abanico (exploración antigua)','CA038':'Labor/rajo con desmonte y camino de acceso dentro del polígono','CA071':'Camino minero en zigzag','CA093':'Pique o rajo con desmonte en la parte alta','CA095':'Rajo/depósito escalonado y tranque: parece faena activa; verificar por qué no tiene concesión vigente','CA098':'Labores y desmontes en la quebrada, construcciones','CA100':'Plataformas, desmontes y huella de acceso','CA114':'Cráter de pique/rajo y construcción con camino','CA140':'Decenas de piques pirquineros alineados (veta) junto a la ruta','CA146':'Zanja/trinchera en la ladera','TP157':'Desmontes blancos y labores con caminos','TP172':'Plataforma y desmonte con red de caminos'},
'B':{'CA013':'Plataforma y estructuras (puede caer fuera del área libre)','CA014':'Huellas en zigzag','CA024':'Desmontes','CA025':'Zanja y pique','CA053':'Estructura y desmonte en la quebrada','CA066':'Camino','CA075':'Área removida en la quebrada','CA078':'Varias huellas','CA079':'Huella y terreno removido','CA081':'Red de caminos con zigzag','CA090':'Construcción y plataforma','CA127':'Pique pequeño con huella','CA135':'Plataforma despejada','CA137':'Huellas y plataforma','CA143':'Desmonte/plataforma','CA147':'Excavación y desmonte','TP002':'Camino en zigzag','TP028':'Camino en zigzag','TP030':'Red de huellas','TP037':'Red de huellas y afloramiento','TP043':'Plataformas y caminos (la mayor parte fuera del área libre)','TP065':'Huellas y desmonte blanco','TP069':'Huellas en zigzag y pique','TP098':'Huellas en zigzag','TP099':'Plataformas/desmontes','TP101':'Huella en la quebrada; labores al lado, fuera del área libre','TP120':'Plataforma despejada y huellas','TP136':'Caminos en zigzag','TP137':'Huellas/zanjas paralelas','TP146':'Camino en zigzag; el rajo queda fuera del área libre','TP147':'Huellas y desmonte pequeño','TP189':'Huellas en zigzag','TP211':'Plataforma con huellas'},
'Alt':{'TP014':'Roca con alteración rojiza, sin labores','TP018':'Afloramientos alterados rojizos','TP053':'Suelo rojizo y huellas','TP117':'Suelo rojo-morado alterado y camino','TP174':'Alteración rojiza en franja','TP183':'Suelo alterado multicolor y desmonte pequeño'}}
J={'ILLAPEL':'Juzgado de Letras de Illapel','SALAMANCA':'Juzgado de Letras y Garantía de Salamanca','CANELA':'Juzgado de Letras y Garantía de Los Vilos (verificar)','LOS VILOS':'Juzgado de Letras y Garantía de Los Vilos','PETORCA':'Juzgado de Letras y Garantía de Petorca (verificar)','CABILDO':'Juzgado de Letras y Garantía de La Ligua (verificar)','LA LIGUA':'Juzgado de Letras y Garantía de La Ligua','SALAMANCA ':'Juzgado de Letras y Garantía de Salamanca'}
rows=[];feats=[]
for cat,d in R.items():
  for cid,nota in d.items():
    c=chips[cid]; vig=VA if c['frame']=='wgs' else VT
    eg=(EA if c['frame']=='wgs' else ET)[(c['n'],c['rol'])]
    occ=[g for g in vig if g.intersects(eg)]
    free=eg.difference(unary_union(occ)) if occ else eg
    free=free.buffer(0)
    p=free.representative_point()
    dx,dy=(0,0) if c['frame']=='wgs' else (200,325)
    lon,lat=tr.transform(p.x,p.y)
    rows.append(dict(cat=cat,id=cid,nombre=c['n'],rol=c['rol'],ex_titular=c['tit'],comuna=c['com'],juzgado=J.get(c['com'],'verificar'),ha_original=c['ha'],ha_libre=round(free.area/1e4,1),
      datum='WGS84 UTM 19S' if c['frame']=='wgs' else 'PSAD56 H19 (marco catastro)',E=round(p.x+dx),N=round(p.y+dy),lat=round(lat,6),lon=round(lon,6),visible=nota))
    feats.append((cat,cid,c['n'],free,nota,round(free.area/1e4,1),c['com']))
order={'A':0,'B':1,'Alt':2}
rows.sort(key=lambda r:(order[r['cat']],-r['ha_libre']))
with open('barrido/barrido_faenas_eliminadas.csv','w',newline='',encoding='utf-8') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
# KML
col={'A':'ff0000ff','B':'ff00aaff','Alt':'ffff00ff'}
def ring(pg): return ' '.join(f"{a:.6f},{b:.6f},0" for a,b in (tr.transform(x,y) for x,y in pg.exterior.coords))
k=['<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Barrido faenas en concesiones eliminadas 18-11-2026</name>']
for cat in ['A','B','Alt']:
  k.append(f'<Style id="s{cat}"><LineStyle><color>{col[cat]}</color><width>2</width></LineStyle><PolyStyle><color>4d{col[cat][2:]}</color></PolyStyle></Style>')
nm={'A':'A - faena clara en área libre','B':'B - indicios (huellas, plataformas)','Alt':'Alteración visible sin labores'}
for cat in ['A','B','Alt']:
  k.append(f'<Folder><name>{nm[cat]}</name>')
  for c2,cid,n,g,nota,ha,com in feats:
    if c2!=cat: continue
    polys=[p for p in getattr(g,'geoms',[g]) if p.geom_type=='Polygon' and p.area>500]
    mg=''.join(f'<Polygon><outerBoundaryIs><LinearRing><coordinates>{ring(p)}</coordinates></LinearRing></outerBoundaryIs></Polygon>' for p in polys)
    k.append(f'<Placemark><name>{cid} {n}</name><description>{com} · {ha} ha libres · {nota}</description><styleUrl>#s{cat}</styleUrl><MultiGeometry>{mg}</MultiGeometry></Placemark>')
  k.append('</Folder>')
k.append('</Document></kml>')
open('barrido/doc.kml','w').write(''.join(k))
import collections
print(collections.Counter((r['cat'],r['comuna']) for r in rows))
for r in rows[:16]: print(r['cat'],r['id'],r['nombre'],r['comuna'],r['ha_libre'],r['E'],r['N'])
