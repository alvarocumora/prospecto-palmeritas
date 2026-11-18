import json,pickle,os
from PIL import Image,ImageDraw,ImageFont
from shapely.geometry import box
from shapely.strtree import STRtree
allf=pickle.load(open('zona/cat_zona.pkl','rb'))
V=[f['g'] for f in allf if f['sit']!='ELIMINADA']; EL=[f['g'] for f in allf if f['sit']=='ELIMINADA' and f['tipo']=='EXPLOTACION']
TV=STRtree(V); TE=STRtree(EL)
ch=json.load(open('/home/claude/prospecto-palmeritas/docs/barrido_faenas/chips_costa_v.json'))
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',14)
os.makedirs('zona/hojas',exist_ok=True)
def dp(d,g,E,N,col,w):
  for p in getattr(g,'geoms',[g]):
    if p.geom_type=='Polygon': d.line([((x-(E-300))/600*480,(N+300-y)/600*480) for x,y in p.exterior.coords],fill=col,width=w)
for k,s in enumerate(range(0,len(ch),12)):
  sh=Image.new('RGB',(1920,1440)); 
  for i,c in enumerate(ch[s:s+12]):
    im=Image.open(f"zona/chips/chip_{c['id']}.jpg"); d=ImageDraw.Draw(im); W=box(c['E']-300,c['N']-300,c['E']+300,c['N']+300)
    for j in TE.query(W): dp(d,EL[j],c['E'],c['N'],(255,255,0),2)
    for j in TV.query(W): dp(d,V[j],c['E'],c['N'],(255,50,50),2)
    m=(c['minas'][0] if c['minas'] else '')[:22]
    d.rectangle([0,0,480,20],fill=(0,0,0)); d.text((3,2),f"{c['id']} {c['com'][:9]} {m}",fill='white',font=f)
    sh.paste(im,((i%4)*480,(i//4)*480))
  sh.save(f'zona/hojas/h{k:02d}.jpg',quality=78)
print(k+1)
