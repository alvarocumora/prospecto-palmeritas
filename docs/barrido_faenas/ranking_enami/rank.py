import json,pickle,math,csv
D=pickle.load(open('rk/distritos.pkl','rb')); B=json.load(open('rk/buyers.json')); R=json.load(open('rutas/rutas_out.json'))
def pago(ley): return 217016-(2.5-ley)*103482
import numpy as np
from pyproj import Geod
G=Geod(ellps='WGS84')
O=json.load(open('/home/claude/prospecto-palmeritas/docs/barrido_faenas/rutas_in.json'))['origenes']
def straight(lon,lat): return [G.inv(lon,lat,b[1],b[2])[2]/1000 for b in B]
RAT=[]
for (lo,la),r in zip(O,R):
  st=straight(lo,la); RAT.append([ (x/1000)/s if x and s>1 else 1.4 for x,s in zip(r['distance'],st)])
O=np.array(O)
for d in D:
  j=int(np.argmin((O[:,0]-d['lon'])**2+(O[:,1]-d['lat'])**2))
  km=[s*min(max(q,1.1),2.5) for s,q in zip(straight(d['lon'],d['lat']),RAT[j])]
  d['km']={b[0]:round(k) for b,k in zip(B,km)}
  # Catemu (privado, estado incierto) solo como alternativa
  enami=[(k,b[0]) for b,k in zip(B,km) if 'CEMIN' not in b[0]]
  k,b=min(enami); d['comprador']=b; d['km_comprador']=round(k)
  d['margen_12']=round(pago(1.2)-6000-130*k); d['margen_10']=round(pago(1.0)-6000-130*k); d['margen_15']=round(pago(1.5)-6000-130*k)
  hist=math.log1p(d['n_pirq'])+0.5*math.log1p(d['n_elim'])
  acc=min(1,(d['libre_hist_ha']+d['propio_ha'])/30)
  d['score']=round(max(0,d['margen_12'])/1000*hist*(0.3+0.7*acc)*(1+0.5*d['satA']+0.15*d['satB']),1)
D.sort(key=lambda d:-d['score'])
for i,d in enumerate(D,1): d['rank']=i
for d in D[:40]:
  print(d['rank'],d['com'],d['nombres'][:40],'|',d['comprador'][:14],d['km_comprador'],'km m12',d['margen_12'],'pirq',d['n_pirq'],'elim',d['n_elim'],'vig',d['n_vig_expl'],'libreH',d['libre_hist_ha'],'prop',d['propio_ha'],'sat',d['satA'],d['satB'],d['score'])
pickle.dump(D,open('rk/rank.pkl','wb'))
