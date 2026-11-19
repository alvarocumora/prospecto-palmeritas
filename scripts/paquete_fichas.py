import json,pickle,os
from PIL import Image,ImageDraw,ImageFont
from shapely.geometry import box,Polygon
from shapely import affinity
P=json.load(open('val/piezas.json')); C=json.load(open('/home/claude/prospecto-palmeritas/docs/barrido_faenas/chips_validar.json'))
V={r['nombre']:r for r in json.load(open('val/validacion.json'))}
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
E=json.load(open('paq/esc.json')); OWN=[Polygon(E[k]['V']) for k in E]+[box(296000,6450350,299000,6451350)]
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
os.makedirs('val/fichas',exist_ok=True)
for p,c in zip(P,C):
  im=Image.open(f"val/d/chip_{c['id']}.jpg").convert('RGB'); S=im.size[0]; d=ImageDraw.Draw(im)
  dx,dy=(200,325) if p['frame']=='psad' else (0,0)
  cx,cy,h=c['E']+dx,c['N']+dy,c['h']
  T=lambda x,y:((x-(cx-h))/(2*h)*S,(cy+h-y)/(2*h)*S)
  W=box(cx-h,cy-h,cx+h,cy+h)
  cat=CA if p['frame']=='wgs' else TP
  for q in cat:
    if q['g'].intersects(W):
      col=(255,230,0) if q['sit']=='ELIMINADA' else (255,40,40); w=1 if q['sit']=='ELIMINADA' else 3
      if q['sit']=='ELIMINADA' and q['tipo']!='EXPLOTACION': continue
      for g in getattr(q['g'],'geoms',[q['g']]):
        if g.geom_type=='Polygon': d.line([T(*xy) for xy in g.exterior.coords],fill=col,width=w)
  if p['frame']=='psad':
    for g in OWN:
      if g.intersects(W): d.line([T(*xy) for xy in g.exterior.coords],fill=(60,140,255),width=3)
    for q in P:
      if q['frame']=='psad' and q['nombre']!=p['nombre']:
        g=box(q['E0'],q['N0'],q['E1'],q['N1'])
        if g.intersects(W): d.line([T(*xy) for xy in g.exterior.coords],fill=(0,255,255),width=2)
  d.rectangle([T(p['E0'],p['N1']),T(p['E1'],p['N0'])],outline=(0,255,0),width=5)
  r=V[p['nombre']]
  d.rectangle([0,0,S,34],fill=(0,0,0)); d.text((6,5),f"{p['nombre']}  {int(p['ha'])} ha · libre {r['libre']} ha · terceros {r['tercero_ha']} ha",fill='white',font=f)
  im.save(f"val/fichas/{c['id']}_{p['nombre'].replace(' ','_')}.jpg",quality=82)
# hojas 3x3 de 600
fs=sorted(os.listdir('val/fichas'))
os.makedirs('val/hojas',exist_ok=True)
for k in range(0,len(fs),9):
  sh=Image.new('RGB',(1800,1800))
  for i,fn in enumerate(fs[k:k+9]): sh.paste(Image.open('val/fichas/'+fn).resize((600,600)),((i%3)*600,(i//3)*600))
  sh.save(f'val/hojas/h{k//9:02d}.jpg',quality=80)
print(len(fs))
