import json, math, numpy as np
from PIL import Image
from pyproj import Transformer
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import Patch, Rectangle, Polygon as MPoly
from matplotlib.lines import Line2D
import matplotlib.patheffects as pe
Image.MAX_IMAGE_PIXELS=None
R='/home/claude/prospecto-palmeritas/'; D=R+'docs/tilama/pedimentos/'; IMG='/tmp/claude-0/ped/img/'
meta={m['archivo']:m for m in json.load(open(IMG+'mosaicos.json'))['mosaicos']}
t=Transformer.from_crs(32719,4326,always_xy=True)
def warp(fname,E0,N0,E1,N1,res):
  m=meta[fname]; im=np.asarray(Image.open(IMG+fname).convert('RGB'))
  E=np.arange(E0,E1,res)+res/2; N=np.arange(N1,N0,-res)-res/2
  EE,NN=np.meshgrid(E,N); lon,lat=t.transform(EE-200,NN-325)
  n=2**m['z']; x=(lon+180)/360*n; y=(1-np.arcsinh(np.tan(np.radians(lat)))/math.pi)/2*n
  px=((x-m['tile_x0'])*256).astype(int); py=((y-m['tile_y0'])*256).astype(int)
  ok=(px>=0)&(py>=0)&(px<im.shape[1])&(py<im.shape[0])
  out=np.full(EE.shape+(3,),235,np.uint8); out[ok]=im[py[ok],px[ok]]
  return (out*0.82+255*0.18).astype(np.uint8)  # aclarar para que resalten capas
cat=[]
for l in open('/tmp/claude-0/ped/datum_hoy.txt'):
  i=l.find('C|{')
  if i>=0: cat.append(json.loads(l[i+2:]))
ARR={'LOS VERDES 4 1/10','LOS VERDES 5 1/12','PEUMO 1/20','LAS TRANCAS1/20'}
ANX={'LOS VERDES 3 1/20','ALTO LOS VERDES 2 1/15','EL CANELO','EL ALTO','PLAZETAS','PLAZETAS 2','EL CANELO 2','BLANQUILLA 1/2','SANTA CAROLINA 2 1/10','SANTA CAROLINA 1/6','CAMPANARIO 2 1/10','LA FLORIDA 1/6','LA FLORIDA 1'}
Pall=json.load(open(D+'presentacion/pedimentos_exploracion.json')); MAN=json.load(open(D+'paquete_minimo/manifestaciones_minimo.json'))
PRI=['LEONOR 2','LEONOR 3','LEONOR 5','MARTINA 2','MARTINA 3','MARTINA 4']; CIN=['LEONOR 4','LEONOR 6','LEONOR 7','LEONOR 8','ELARA 19','ELARA 21']
G=json.load(open(R+'src/data/geo/tilama/geochem_core.json'))
S=[(x['Muestra'],(x['Cu_ppm'] or 0)/1e4,x['Este_UTM']+17,x['Norte_UTM']-49) for x in G if x['Este_UTM']]
osm=json.load(open(IMG+'osm.geojson')); ti=Transformer.from_crs(4326,32719,always_xy=True)
roads=[]
for f in osm['features']:
  if f['geometry']['type']=='LineString' and f['properties'].get('highway') in ('primary','secondary','tertiary','unclassified','track'):
    xy=[ti.transform(*c) for c in f['geometry']['coordinates']]; roads.append((f['properties']['highway'],[(x+200,y+325) for x,y in xy]))
C={'arr':'#f1c40f','anx':'#f9e79f','exp':'#c2185b','pri':'#e67e22','cin':'#f0b27a','res':'#7f8c8d','ter':'#95a5a6'}
def base(ax,E0,N0,E1,N1,fname,res,detail=False):
  ax.imshow(warp(fname,E0,N0,E1,N1,res),extent=(E0,E1,N0,N1),interpolation='bilinear',zorder=0)
  for k,pts in roads:
    xs,ys=zip(*pts); ax.plot(xs,ys,color='#ffffff' if k!='track' else '#fdfefe',lw=1.6 if k!='track' else .7,alpha=.9 if k!='track' else .55,zorder=1)
  for r in cat:
    n=r['n']; xy=r['psad']
    if n in ARR: fc,ec,lw,a=C['arr'],'#9a7d0a',1.6,.55
    elif n in ANX: fc,ec,lw,a=C['anx'],'#b7950b',1,.35
    else: fc,ec,lw,a='none','#5d6d7e',.6,1
    ax.add_patch(MPoly(xy,closed=True,fc=fc,ec=ec,lw=lw,alpha=a if fc!='none' else 1,zorder=2))
    if n in ARR|ANX:
      xs=[p[0] for p in xy]; ys=[p[1] for p in xy]; cx,cy=sum(xs)/len(xs),sum(ys)/len(ys)
      if E0<cx<E1 and N0<cy<N1: ax.text(cx,cy,n.replace(' 1/','\n1/'),fontsize=5.2 if not detail else 7,ha='center',va='center',color='#5b4a00',zorder=6)
  for p in Pall:
    if p['nombre'] in PRI: fc,ec,ls,a=C['pri'],'#a04000','-',.42
    elif p['nombre'] in CIN: fc,ec,ls,a=C['cin'],'#ca6f1e','-',.32
    else: fc,ec,ls,a='none','#ffffff','--',1
    ax.add_patch(Rectangle((p['E0'],p['N0']),p['E1']-p['E0'],p['N1']-p['N0'],fc=fc,ec=ec,ls=ls,lw=1.4 if fc!='none' else 1.1,alpha=a if fc!='none' else .9,zorder=3))
    if E0<p['pm_E']<E1 and N0<p['pm_N']<N1:
      ax.text(p['pm_E'],p['pm_N'],f"{p['nombre']}\n{p['ha']} ha",fontsize=6.3 if not detail else 8,ha='center',va='center',weight='bold',color='#4a235a' if p['nombre'].startswith('MARTINA') else ('#6e2c00' if fc!='none' else 'white'),zorder=7,path_effects=[] if fc!='none' else [pe.withStroke(linewidth=2,foreground='#2c3e50')])
  for m in MAN:
    r=m['rect']; ax.add_patch(Rectangle((r['E0'],r['N0']),r['EW'],r['NS'],fc='none',ec=C['exp'],ls=':',lw=1.2,zorder=4))
    for q in m['pertenencias']: ax.add_patch(Rectangle((q['E0'],q['N0']),q['E1']-q['E0'],q['N1']-q['N0'],fc=C['exp'],ec='#880e4f',lw=.3,alpha=.75,zorder=4))
    ax.text(r['E1']+40,r['N1']+30,m['nombre'],fontsize=7 if not detail else 9,color='#880e4f',weight='bold',zorder=8)
  for n,cu,e,nn in S:
    if cu>=.2: ax.scatter(e,nn,s=(26 if cu>=1 else 10)*(1.6 if detail else 1),c='#e74c3c' if cu>=1 else '#f39c12',ec='k',lw=.35,zorder=9)
    if detail and cu>=1.5 and E0<e<E1 and N0<nn<N1: ax.text(e+40,nn+25,f"{n} {cu:.1f}%",fontsize=6.3,color='#641e16',zorder=10,bbox=dict(fc='white',ec='none',alpha=.6,pad=.4))
  ax.scatter(302267,6453251,marker='*',s=260 if detail else 160,c='#ffeb3b',ec='k',lw=.8,zorder=11)
  ax.text(302267+80,6453251-90,'Faena M1/M2\n7,7–10,7 % CuT',fontsize=7 if not detail else 9,weight='bold',color='#1b2631',zorder=11,bbox=dict(fc='white',ec='none',alpha=.75,pad=.6))
  acc=[(301450,6454050),(301750,6454200),(302000,6454270),(302350,6454190),(302600,6454170),(302750,6454300),(302750,6454550)]
  xs,ys=zip(*acc); ax.plot(xs,ys,color='#00e676',lw=2.4,zorder=10); 
  ax.set_xlim(E0,E1); ax.set_ylim(N0,N1); ax.set_aspect('equal')
  ax.ticklabel_format(useOffset=False,style='plain'); ax.tick_params(labelsize=6.5)
  for lab in ax.get_xticklabels()+ax.get_yticklabels(): lab.set_fontsize(6.5)
  ax.grid(color='white',alpha=.35,lw=.5)
def norte_escala(ax,E0,N0,E1,N1,L=1000):
  x=E1-(E1-E0)*.06; y=N1-(N1-N0)*.08
  ax.annotate('N',xy=(x,y),xytext=(x,y-(N1-N0)*.06),ha='center',fontsize=11,weight='bold',color='white',arrowprops=dict(arrowstyle='-|>',color='white',lw=2),zorder=20)
  sx=E0+(E1-E0)*.04; sy=N0+(N1-N0)*.04
  ax.add_patch(Rectangle((sx,sy),L,(N1-N0)*.006,fc='white',ec='k',zorder=20)); ax.add_patch(Rectangle((sx,sy),L/2,(N1-N0)*.006,fc='k',zorder=21))
  ax.text(sx+L/2,sy+(N1-N0)*.014,f'{L:,} m'.replace(',','.'),ha='center',fontsize=8,color='white',weight='bold',zorder=21)
LEG=[Patch(fc=C['exp'],ec='#880e4f',alpha=.75,label='Fase I · Explotación propia: LEONOR 1 y MARTINA 1 (pertenencias a mensurar)'),
 Line2D([],[],color=C['exp'],ls=':',label='Rectángulo manifestado'),
 Patch(fc=C['pri'],ec='#a04000',alpha=.5,label='Fase I · Exploración prioritaria: LEONOR 2, 3, 5 y MARTINA 2–4 (1.100 ha)'),
 Patch(fc=C['cin'],ec='#ca6f1e',alpha=.45,label='Fase I · Cinturón de exploración: LEONOR 4, 6–8, ELARA 19 y 21 (1.400 ha)'),
 Patch(fc=C['arr'],ec='#9a7d0a',alpha=.6,label='Fase I · Arranque integrado (arriendo): Los Verdes 4 y 5, Peumo 1, Las Trancas 1'),
 Patch(fc=C['anx'],ec='#b7950b',alpha=.5,label='Fase II · Anexos del proyecto integrado (terceros)'),
 Patch(fc='#7f8c8d',ec='white',ls='--',label='Fase III · Exploración ampliada, tras el terreno (ELARA y LEONOR restantes)'),
 Patch(fc='none',ec='#5d6d7e',label='Otras concesiones de terceros'),
 Line2D([],[],color='#00e676',lw=2.4,label='Acceso norte a la faena (fotointerpretado)'),
 Line2D([],[],marker='*',ls='',mfc='#ffeb3b',mec='k',ms=11,label='Faena M1/M2 (desmontes, mina antigua La Guanaca)'),
 Line2D([],[],marker='o',ls='',mfc='#e74c3c',mec='k',label='Muestra ≥ 1 % Cu'),Line2D([],[],marker='o',ls='',mfc='#f39c12',mec='k',ms=5,label='Muestra 0,2–1 % Cu')]
def cajetin(fig,titulo,sub):
  fig.text(.012,.975,titulo,fontsize=15,weight='bold',color='#1b2631',va='top')
  fig.text(.012,.947,sub,fontsize=8.5,color='#566573',va='top')
  fig.text(.012,.012,'Valle Escondido SpA (Minera Valle Escondido SpA) · Proyecto Tilama / Los Verdes, Los Vilos, Región de Coquimbo · Coordenadas UTM PSAD56 (La Canoa 1956) Huso 19, marco catastro SERNAGEOMIN · Catastro al 15-11-2026 · Imagen Esri World Imagery · Borrador de trabajo, no es plano oficial ni de mensura.',fontsize=6.6,color='#566573')
with PdfPages(D+'tilama_plano_fases.pdf') as pdf:
  # Lámina 1: plano general
  E0,N0,E1,N1=289500,6447500,308400,6457800
  fig=plt.figure(figsize=(16.54,11.69))
  ax=fig.add_axes([.012,.045,.70,.885]); base(ax,E0,N0,E1,N1,'mosaico_general_z16.jpg',8); norte_escala(ax,E0,N0,E1,N1,2000)
  cajetin(fig,'Proyecto Minero Integrado Tilama / Los Verdes — plano de fases','Lámina 1 de 3 · Plano general: concesiones propias por fase, bloque Los Verdes a integrar, muestras y accesos')
  lx=fig.add_axes([.725,.36,.265,.57]); lx.axis('off'); lx.legend(handles=LEG,loc='upper left',fontsize=7.4,frameon=False,title='Fases',title_fontsize=9,alignment='left',labelspacing=1.0)
  tx=fig.add_axes([.725,.045,.265,.30]); tx.axis('off')
  rows=[('Fase I explotación','LEONOR 1 + MARTINA 1','243 ha manif.'),('Fase I exploración prioritaria','6 pedimentos','1.100 ha'),('Fase I cinturón','6 pedimentos','1.400 ha'),('Fase I arranque integrado','4 concesiones terceros','349 ha'),('Fase II anexos','13 concesiones terceros','~1.600 ha'),('Fase III ampliación','22 pedimentos','5.300 ha')]
  tb=tx.table(cellText=rows,colLabels=['Fase','Piezas','Superficie'],loc='upper left',colWidths=[.48,.32,.2],cellLoc='left')
  tb.auto_set_font_size(False); tb.set_fontsize(7.2); tb.scale(1,1.45)
  for (r,c),cell in tb.get_celld().items():
    cell.set_edgecolor('#d5d8dc'); 
    if r==0: cell.set_facecolor('#1b2631'); cell.get_text().set_color('white'); cell.get_text().set_weight('bold')
  pdf.savefig(fig); plt.close(fig)
  # Lámina 2: detalle núcleo
  E0,N0,E1,N1=300000,6449800,304600,6455600
  fig=plt.figure(figsize=(16.54,11.69))
  ax=fig.add_axes([.012,.045,.70,.885]); base(ax,E0,N0,E1,N1,'mosaico_general_z16.jpg',2.5,True); norte_escala(ax,E0,N0,E1,N1,500)
  cajetin(fig,'Núcleo: faena LEONOR 1, MARTINA 1 y bloque Los Verdes','Lámina 2 de 3 · Detalle de la explotación inicial y de la exploración prioritaria alrededor de la faena')
  lx=fig.add_axes([.725,.36,.265,.57]); lx.axis('off'); lx.legend(handles=LEG,loc='upper left',fontsize=7.4,frameon=False,title='Fases',title_fontsize=9,alignment='left',labelspacing=1.0)
  tx=fig.add_axes([.725,.05,.265,.29]); tx.axis('off')
  tx.text(0,1,'Lectura del detalle',fontsize=9,weight='bold',va='top')
  tx.text(0,.9,'• LEONOR 1: hasta 33 pertenencias de 5 ha sobre la faena M1/M2 y TOO-255.\n  En la mensura se parte con 5 pertenencias clave.\n• MARTINA 1: TOO-256 (4,9 % Cu), pegada al este de LEONOR 1.\n• LEONOR 3 y 5: las leyes del sur (TOO-237 5,0 %, TOO-240 4,7 %).\n• Las leyes más altas del distrito (TOO-210, 195, 198, 220)\n  están en el bloque Los Verdes: se incorporan por arriendo\n  o por opción, no por pedimento.\n• El acceso norte pasa por terreno de terceros:\n  requiere servidumbre.',fontsize=7.4,va='top',linespacing=1.45)
  pdf.savefig(fig); plt.close(fig)
  # Lámina 3: fases de trabajo
  fig=plt.figure(figsize=(16.54,11.69))
  cajetin(fig,'Fases de exploración y explotación','Lámina 3 de 3 · Programa por etapas con hitos de decisión. Montos en pesos de noviembre de 2026 (UTM $72.440); terreno y perito a cotizar.')
  fases=[
   ('FASE 0','Semanas 0–2','Presentación y resguardo',['Cotejar ensayes clave con el original de EMT','Contratar perito; revisar los puntos de los escritos','Presentar por OJV: LEONOR 1, MARTINA 1 y 12 pedimentos','Revisar títulos del bloque Los Verdes (vigencia, patentes, gravámenes)'],'Tasas ≈ $1,2 M · Boletín e inscripción ≈ $2,3 M','#1b2631'),
   ('FASE I-A','Días 0–90','Validación en terreno',['GPS de faena M1/M2 y muestras clave (TOO-256, 237, 240, 253, 280, 286)','Remuestreo por canaletas con QA/QC en LEONOR 3, M1/M2 y franja Martina','Recorrer accesos: huella norte, zigzag ELARA 19, corredor sur LEONOR 5','Identificar dueños superficiales y negociar servidumbres','Carta de intención con titulares del bloque Los Verdes'],'Campaña de 3–4 días y análisis: a cotizar','#a04000'),
   ('HITO','Día 90','Decisión',['Sentencia solo de los pedimentos con resultado','Mensura de LEONOR 1 y MARTINA 1 (días 91–120)','Inscripción ENAMI como pequeña minería','Firma de arriendo del arranque integrado'],'Patente de lo prioritario ≈ $5,8 M/año','#7d3c98'),
   ('FASE I-B','Meses 4–12','Explotación inicial',['Pequeña minería sobre la faena de LEONOR 1: limpieza y muestreo de desmontes','Venta de mineral oxidado a ENAMI según pauta vigente','Permisos: Sernageomin (método de explotación y cierre), art. 17 donde aplique','Arranque integrado: Los Verdes 4 y 5, Peumo 1, Las Trancas 1 (canon 10 % sobre ventas)'],'Según plan de inversión y resultados de terreno','#c2185b'),
   ('FASE II','Años 1–2','Exploración sistemática',['Mapeo 1:5.000 y geoquímica en todo el distrito integrado','Geofísica (magnetometría y gamma-espectrometría, IP donde convenga)','Sondajes de reconocimiento en los blancos validados','Incorporación de anexos al proyecto integrado según hitos'],'Programa a definir con los resultados de Fase I','#1f618d'),
   ('FASE III','Años 2–4','Recurso y valorización',['Ampliación de la exploración a los pedimentos de borde que muestren interés','Estimación de recursos y reporte técnico bajo estándar NI 43-101 / JORC','Data room unificado y venta o financiamiento del proyecto como un todo'],'Según resultados','#117864')]
  y=.89; h=.127
  for k,(f,cuando,tit,items,costo,col) in enumerate(fases):
    yy=y-k*(h+.012)
    fig.patches.append(Rectangle((.012,yy-h),.12,h,transform=fig.transFigure,fc=col,ec='none'))
    fig.text(.072,yy-h/2+.02,f,fontsize=14,weight='bold',color='white',ha='center',va='center')
    fig.text(.072,yy-h/2-.022,cuando,fontsize=9,color='white',ha='center',va='center')
    fig.patches.append(Rectangle((.132,yy-h),.856,h,transform=fig.transFigure,fc='#f8f9f9',ec='#d5d8dc'))
    fig.text(.145,yy-.018,tit,fontsize=11.5,weight='bold',color=col,va='top')
    fig.text(.145,yy-.045,'\n'.join('•  '+i for i in items),fontsize=8.6,va='top',color='#1b2631',linespacing=1.5)
    fig.text(.975,yy-.018,costo,fontsize=8.4,ha='right',va='top',color='#566573',style='italic')
  pdf.savefig(fig); plt.close(fig)
print('ok')
