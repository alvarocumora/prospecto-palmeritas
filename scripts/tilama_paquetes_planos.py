import json, os, csv
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Polygon as MPoly
import matplotlib.patheffects as pe
from shapely.geometry import box, Polygon
R='/home/claude/prospecto-palmeritas/docs/tilama/pedimentos/'
OUT=R+'presentado/paquetes/'; os.makedirs(OUT,exist_ok=True)
P={p['nombre']:p for p in json.load(open(R+'presentacion/pedimentos_exploracion.json'))}
M={m['nombre']:m for m in json.load(open(R+'paquete_minimo/manifestaciones_minimo.json'))}
ROL=json.load(open('/tmp/claude-0/ped/rolmap.json'))
cat=[]
for l in open('/tmp/claude-0/ped/datum_hoy.txt'):
  i=l.find('C|{')
  if i>=0: r=json.loads(l[i+2:]); cat.append((r['n'],r['rol'],r['sit'],Polygon(r['psad']).buffer(0),r['psad']))
KEY_L1=[12,13,14,15,31]
own=[(n,box(p['E0'],p['N0'],p['E1'],p['N1'])) for n,p in P.items() if n in [v for v in ROL.values()]]
fmt=lambda v:f"{v:,.2f}".replace(',','X').replace('.',',').replace('X','.')
def plano(rol,nombre,tipo):
  fig=plt.figure(figsize=(16.54,11.69))
  ax=fig.add_axes([.04,.06,.62,.88])
  if tipo=='ped':
    p=P[nombre]; E0,N0,E1,N1=p['E0'],p['N0'],p['E1'],p['N1']; pm=(p['pm_E'],p['pm_N'])
    verts=[('V1 (NW)',E0,N1),('V2 (NE)',E1,N1),('V3 (SE)',E1,N0),('V4 (SW)',E0,N0)]
    titulo=f'Pedimento de exploración "{nombre}"'; sup=f"{p['ha']} ha ({p['NS']:,} m N-S × {p['EW']:,} m E-O)".replace(',','.')
    ptxt='Punto medio'
  else:
    m=M[nombre]; r=m['rect']; E0,N0,E1,N1=r['E0'],r['N0'],r['E1'],r['N1']; pm=(m['pi_E'],m['pi_N'])
    verts=[('V1 (NW)',E0,N1),('V2 (NE)',E1,N1),('V3 (SE)',E1,N0),('V4 (SW)',E0,N0)]
    titulo=f'Manifestación "{nombre}, 1 AL {r["ha"]}"'; sup=f"Rectángulo {r['ha']} ha ({r['NS']:,} m N-S × {r['EW']:,} m E-O)".replace(',','.')
    ptxt='Punto de interés'
  w,h=E1-E0,N1-N0; pad=max(w,h)*0.55
  X0,X1,Y0,Y1=E0-pad,E1+pad,N0-pad,N1+pad
  # mantener proporción del eje
  ax.set_xlim(X0,X1); ax.set_ylim(Y0,Y1); ax.set_aspect('equal',adjustable='datalim')
  view=box(X0-pad,Y0-pad,X1+pad,Y1+pad)
  for n,rr,sit,g,pts in cat:
    if not g.intersects(view): continue
    ax.add_patch(MPoly(pts,closed=True,fc='#fdecea' if sit=='EN TRAMITE' else '#eef2f7',ec='#7f8c8d',lw=.6,zorder=1))
    c=g.intersection(view).representative_point()
    ax.text(c.x,c.y,f"{n}\n({'en trámite' if sit=='EN TRAMITE' else 'constituida'})",fontsize=6,ha='center',va='center',color='#566573',zorder=2)
  for n,b in own:
    if n==nombre or not b.intersects(view): continue
    x,y=b.exterior.xy; ax.plot(x,y,color='#e67e22',lw=1,ls='--',zorder=3)
    c=b.intersection(view).representative_point(); ax.text(c.x,c.y,n,fontsize=7,color='#a04000',ha='center',zorder=3)
  for n,m2 in M.items():
    if n==nombre and tipo=='man': continue
    r2=m2['rect']; b=box(r2['E0'],r2['N0'],r2['E1'],r2['N1'])
    if b.intersects(view): x,y=b.exterior.xy; ax.plot(x,y,color='#c2185b',lw=1,ls=':',zorder=3)
  ax.add_patch(Rectangle((E0,N0),w,h,fc='#fde3c6' if tipo=='ped' else 'none',ec='#c0392b',lw=2.6,zorder=5,alpha=.9))
  rows=[]
  if tipo=='man':
    sel=KEY_L1 if nombre=='LEONOR 1' else [q['n'] for q in m['pertenencias']]
    for q in m['pertenencias']:
      on=q['n'] in sel
      ax.add_patch(Rectangle((q['E0'],q['N0']),q['E1']-q['E0'],q['N1']-q['N0'],fc='#f8bbd0' if on else 'none',ec='#880e4f',lw=1.2 if on else .4,zorder=6))
      ax.text((q['E0']+q['E1'])/2,(q['N0']+q['N1'])/2,str(q['n']),fontsize=7 if not on else 8,ha='center',va='center',weight='bold' if on else 'normal',color='#4a0026',zorder=7)
      if on: rows.append(q)
  for lab,x,y in verts:
    ax.plot(x,y,'s',ms=6,color='#c0392b',zorder=8); ax.text(x,y,' '+lab.split()[0],fontsize=9,weight='bold',color='#922b21',va='bottom',zorder=8,path_effects=[pe.withStroke(linewidth=2.5,foreground='white')])
  ax.plot(*pm,'o',ms=9,mfc='white',mec='#c0392b',mew=2,zorder=9); ax.text(pm[0],pm[1],f'  {ptxt}',fontsize=9,weight='bold',color='#922b21',zorder=9,path_effects=[pe.withStroke(linewidth=2.5,foreground='white')])
  step=500 if max(w,h)<=2000 else 1000
  import numpy as np
  xt=np.arange((X0//step+1)*step,X1,step); yt=np.arange((Y0//step+1)*step,Y1,step)
  ax.set_xticks(xt); ax.set_yticks(yt); ax.grid(color='#aab7b8',lw=.5,ls='-',alpha=.6)
  ax.set_xticklabels([f'{int(v):,}'.replace(',','.') for v in xt],fontsize=7); ax.set_yticklabels([f'{int(v):,}'.replace(',','.') for v in yt],fontsize=7)
  ax.set_xlabel('Este (m) — UTM PSAD56 Huso 19',fontsize=8); ax.set_ylabel('Norte (m)',fontsize=8)
  xl=ax.get_xlim(); yl=ax.get_ylim()
  L=500 if step==500 else 1000; sx=xl[0]+(xl[1]-xl[0])*.04; sy=yl[0]+(yl[1]-yl[0])*.04
  ax.add_patch(Rectangle((sx,sy),L,(yl[1]-yl[0])*.008,fc='black',zorder=10)); ax.add_patch(Rectangle((sx+L/2,sy),L/2,(yl[1]-yl[0])*.008,fc='white',ec='black',zorder=11))
  ax.text(sx+L/2,sy+(yl[1]-yl[0])*.018,f'{L} m',ha='center',fontsize=8,zorder=11)
  nx=xl[1]-(xl[1]-xl[0])*.05; ny=yl[1]-(yl[1]-yl[0])*.1
  ax.annotate('N',xy=(nx,ny+(yl[1]-yl[0])*.06),xytext=(nx,ny),ha='center',fontsize=13,weight='bold',arrowprops=dict(arrowstyle='-|>',lw=2,color='black'),zorder=12)
  # cajetín y cuadro
  cx=fig.add_axes([.68,.06,.30,.88]); cx.axis('off')
  y=1.0
  def line(txt,sz=9,bold=False,col='#1b2631',dy=.032):
    nonlocal y; cx.text(0,y,txt,fontsize=sz,weight='bold' if bold else 'normal',color=col,va='top',transform=cx.transAxes); y-=dy
  line('PLANO DE UBICACIÓN',13,True,dy=.035); line(titulo,10.5,True,col='#922b21',dy=.04)
  line(f'Juzgado de Letras y Garantía de Los Vilos · Rol {rol}',9)
  line('Titular: Valle Escondido SpA · RUT 78.524.757-4',9)
  line('Rep. legal: Álvaro Cumora Oliva Herrera · RUT 19.141.778-K',9)
  line('Comuna de Los Vilos, provincia de Choapa, Región de Coquimbo',9)
  line(f'Superficie: {sup}',9)
  line('Datum Provisorio Sudamericano La Canoa 1956, Elipsoide',9,dy=.026); line('Internacional 1924, proyección UTM Huso 19',9,dy=.04)
  line(f'{ptxt}:  N {fmt(pm[1])}  ·  E {fmt(pm[0])}',9.5,True,dy=.045)
  line('Cuadro de coordenadas de vértices',10,True,dy=.03)
  for lab,x,yy in verts: line(f'{lab:<9}  N {fmt(yy)}   E {fmt(x)}',8.5,dy=.026)
  y-=.012
  if rows:
    line(f'Pertenencias a mensurar ({len(rows)}, {sum(q["ha"] for q in rows)} ha)',10,True,dy=.03)
    for q in rows:
      line(f'N° {q["n"]:>2}: N {fmt(q["N0"])}–{fmt(q["N1"])} · E {fmt(q["E0"])}–{fmt(q["E1"])} · {q["ha"]} ha',7.6,dy=.023)
    y-=.01
  line('Simbología',10,True,dy=.03)
  for c,txt in (('#c0392b','Concesión solicitada (lindero)'),('#880e4f','Pertenencias (rellenas: a mensurar)'),('#e67e22','Otros pedimentos del titular'),('#7f8c8d','Concesiones de terceros (catastro SERNAGEOMIN 15-11-2026)')):
    line(f'■  {txt}',8,col=c,dy=.024)
  y-=.015
  line('Plano referencial de ubicación. Debe ser revisado, ratificado y',7.6,col='#566573',dy=.02)
  line('firmado por ingeniero o perito mensurador antes de acompañarse.',7.6,col='#566573',dy=.05)
  line('______________________________',9,dy=.025); line('Firma y timbre del profesional',8,dy=.022); line('Nombre / RUT / N° registro: ____________________',8,dy=.04)
  fig.text(.04,.965,f'{titulo} — Rol {rol}',fontsize=13,weight='bold')
  fig.patches.append(Rectangle((.008,.012),.984,.976,transform=fig.transFigure,fill=False,lw=1.5,ec='black'))
  d=OUT+f"{rol}_{nombre.replace(' ','_')}/"; os.makedirs(d,exist_ok=True)
  fig.savefig(d+f"plano_{nombre.replace(' ','_')}.pdf"); plt.close(fig)
  with open(d+f"vertices_{nombre.replace(' ','_')}.csv",'w',newline='',encoding='utf-8-sig') as f:
    w_=csv.writer(f,delimiter=';'); w_.writerow(['punto','norte','este','datum'])
    w_.writerow([ptxt,pm[1],pm[0],'PSAD56 H19'])
    for lab,x,yy in verts: w_.writerow([lab,yy,x,'PSAD56 H19'])
    for q in rows:
      for lab,x,yy in (('NW',q['E0'],q['N1']),('NE',q['E1'],q['N1']),('SE',q['E1'],q['N0']),('SW',q['E0'],q['N0'])): w_.writerow([f'Pertenencia {q["n"]} {lab}',yy,x,'PSAD56 H19'])
  return d,rows
res={}
for rol,n in ROL.items():
  if 'duplicado' in n: continue
  nm=n.split(',')[0]; tipo='man' if nm in M else 'ped'
  d,rows=plano(rol,nm,tipo); res[rol]=dict(nombre=nm,tipo=tipo,dir=d,pert=rows)
json.dump(res,open('/tmp/claude-0/ped/paq/res.json','w'),ensure_ascii=False,default=str)
print(len(res))
