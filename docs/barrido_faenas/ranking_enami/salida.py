import pickle,json,csv
from pyproj import Transformer
tr=Transformer.from_crs(32719,4326,always_xy=True)
D=pickle.load(open('rk/rank.pkl','rb')); B=json.load(open('rk/buyers.json'))
V={1:('A','Caminos en zigzag, labores y desmontes; ya hay 273 ha nuestras (MARTINA Petorca)'),2:('B','Huellas y piques pequeños'),3:('B','Rajo/plataforma con desmonte claro, pero tapado por concesión vigente: arrendar'),
4:('B','Huellas; rajo pequeño junto al pueblo'),5:('A','Caminos en zigzag y plataformas en la ladera'),6:('C','Poco libre (35 ha); distrito activo'),7:('C','Instalaciones cerca de Illapel; poco libre'),
8:('C','Huellas'),9:('B','Zigzag y labores en concesiones antiguas rotadas'),10:('A*','Faena grande activa (zigzag, desmontes) casi toda en concesiones vigentes: candidata a arriendo/compra'),
11:('B','Huellas en zigzag'),12:('A','Desmontes con color verde-azul (óxidos de cobre) y labores dentro del área eliminada'),13:('C','Laderas sin labores claras'),
14:('B','Huellas'),15:('A','Caminos en zigzag a labores (MAITEN), sin concesiones vigentes'),16:('B','Plataforma y labores al borde'),17:('C','Sin labores claras'),
18:('B','Huellas en zigzag'),19:('C','Pastizal, cercos'),20:('A','Cantera/rajo blanco y desmontes; 267 ha ya nuestras (Tilama)'),21:('A*','Rajo activo grande de terceros; desmontes alrededor'),
22:('A','Labores y desmontes blancos; 246 ha ya nuestras (Petorca sur)'),23:('B','Alteración rojiza y morada, labores menores'),24:('B','Rajo con desmonte (en concesión vigente) y labores blancas'),
25:('B','Alteración; labores menores (CELESTE)'),26:('C','Planta con piscinas cerca de Combarbalá; resto sin labores'),27:('C','Sin labores claras'),28:('B','Desmonte rojizo/labor en la ladera'),
29:('C','Sin labores claras'),30:('B','Huellas'),31:('X','Dunas costeras: descartar'),32:('B','Huellas en zigzag y desmonte blanco al borde'),33:('C','Huellas'),34:('C','Sin labores claras'),
35:('A','Camino en zigzag a labores y alteración rojiza; a 4 km de Combarbalá'),36:('C','Sin labores claras')}
J={'CABILDO':'La Ligua (verificar)','PETORCA':'Petorca (verificar)','LA LIGUA':'La Ligua','ILLAPEL':'Illapel','SALAMANCA':'Salamanca','CANELA':'Los Vilos (verificar)','COMBARBALA':'Combarbalá','LOS VILOS':'Los Vilos','HIJUELAS':'Quillota (verificar)','SAN FELIPE':'San Felipe','PUNITAQUI':'Ovalle (verificar)','CATEMU':'San Felipe (verificar)'}
rows=[]
for d in D[:60]:
  v=V.get(d['rank'],('—','No revisado en imagen'))
  rows.append(dict(rank=d['rank'],sat=v[0],comuna=d['com'],juzgado=J.get(d['com'],'verificar'),minas=d['nombres'],comprador=d['comprador'],km_camino=d['km_comprador'],
    km_Cabildo=d['km'][B[0][0]],km_Illapel=d['km'][B[1][0]],km_Ovalle=d['km'][B[2][0]],km_Combarbala=d['km'][B[3][0]],
    margen_1_0=d['margen_10'],margen_1_2=d['margen_12'],margen_1_5=d['margen_15'],pirquenes=d['n_pirq'],elim=d['n_elim'],vigentes=d['n_vig_expl'],
    libre_hist_ha=d['libre_hist_ha'],propio_ha=d['propio_ha'],titulares_vigentes=d['tit_vig'],lat=round(d['lat'],5),lon=round(d['lon'],5),E_wgs=d['E'],N_wgs=d['N'],visible=v[1],score=d['score']))
with open('rk/ranking_distritos.csv','w',newline='',encoding='utf-8') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
col={'A':'ff0000ff','A*':'ff00ffff','B':'ff00aaff','C':'ff888888','X':'ff444444','—':'ff888888'}
k=['<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Ranking distritos ENAMI 19-11-2026</name>']
for c,v in col.items(): k.append(f'<Style id="s{len(k)}"><LineStyle><color>{v}</color><width>2</width></LineStyle><PolyStyle><color>33{v[2:]}</color></PolyStyle></Style>')
sid={c:f"s{i+1}" for i,c in enumerate(col)}
k.append('<Folder><name>Compradores</name>')
for n,lo,la in B: k.append(f'<Placemark><name>{n}</name><Point><coordinates>{lo},{la},0</coordinates></Point></Placemark>')
k.append('</Folder><Folder><name>Distritos</name>')
for d,r in zip(D[:60],rows):
  ring=' '.join(f"{x:.5f},{y:.5f},0" for x,y in (tr.transform(a,b) for a,b in d['hull'].exterior.coords))
  k.append(f"<Placemark><name>#{r['rank']} {r['comuna']} {r['minas'][:30]}</name><description>Sat {r['sat']}: {r['visible']} · {r['comprador']} {r['km_camino']} km · margen 1,2% ~${r['margen_1_2']:,}/t · libre hist {r['libre_hist_ha']} ha · propio {r['propio_ha']} ha</description><styleUrl>#{sid[r['sat']]}</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>{ring}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>")
k.append('</Folder></Document></kml>'); open('rk/doc.kml','w').write(''.join(k))
# mapa
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fig,ax=plt.subplots(figsize=(8,11))
cm={'A':'#d62728','A*':'#e6b800','B':'#ff7f0e','C':'#999999','X':'#444444','—':'#cccccc'}
allD=pickle.load(open('rk/rank.pkl','rb'))
ax.scatter([d['lon'] for d in allD[60:]],[d['lat'] for d in allD[60:]],s=8,c='#dddddd',label='otros distritos')
for r in rows:
  ax.scatter(r['lon'],r['lat'],s=60 if r['sat'] in('A','A*') else 25,c=cm[r['sat']],edgecolor='k',linewidth=.4,zorder=3)
  if r['rank']<=36 and r['sat'] in ('A','A*','B'): ax.annotate(str(r['rank']),(r['lon'],r['lat']),fontsize=7,xytext=(3,2),textcoords='offset points')
for n,lo,la in B: ax.scatter(lo,la,marker='s',s=90,c='#1f77b4',edgecolor='k',zorder=4); ax.annotate(n.split(' (')[0],(lo,la),fontsize=8,xytext=(5,-10),textcoords='offset points',color='#1f77b4',weight='bold')
for c,l in [('A','A: faena clara con área libre'),('A*','A*: faena grande en concesión vigente'),('B','B: indicios'),('C','C: sin labores claras')]: ax.scatter([],[],c=cm[c],label=l)
ax.legend(loc='lower left',fontsize=8); ax.set_aspect(1/0.85); ax.set_title('Distritos con historia minera y poderes de compra (rank 1–60)',fontsize=10)
ax.set_xlabel('lon'); ax.set_ylabel('lat'); plt.tight_layout(); plt.savefig('rk/mapa_ranking.png',dpi=150)
for r in rows[:36]: print(r['rank'],r['sat'],r['comuna'],r['minas'][:28],r['comprador'][:10],r['km_camino'],r['margen_1_2'],r['libre_hist_ha'],r['propio_ha'])
