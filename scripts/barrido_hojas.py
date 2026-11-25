import json,pickle,os
from PIL import Image,ImageDraw,ImageFont
from shapely.geometry import box
from shapely.ops import unary_union
from shapely import affinity
chips=json.load(open('chips.json')); D='chipsimg/'
RA=pickle.load(open('ca_cat2.pkl','rb')); L=pickle.load(open('elim.pkl','rb')); C=pickle.load(open('cat_1811.pkl','rb'))
VA=[r['g'] for r in RA if r['sit']!='ELIMINADA']; VT=[affinity.translate(r['g'],-200,-325) for r in C]
EA={(r['n'],r['rol']):r['g'] for r in RA if r['sit']=='ELIMINADA'}; ET={(r['n'],r['rol']):affinity.translate(r['g'],-200,-325) for r in L}
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',15)
os.makedirs('sheets',exist_ok=True)
def draw_poly(d,g,c,E,N,col,w):
  for p in getattr(g,'geoms',[g]):
    if p.geom_type!='Polygon': continue
    d.line([((x-(E-300))/600*480,(N+300-y)/600*480) for x,y in p.exterior.coords],fill=col,width=w)
k=0
for s in range(0,len(chips),12):
  sheet=Image.new('RGB',(4*480,3*480),'black'); d=ImageDraw.Draw(sheet)
  for i,c in enumerate(chips[s:s+12]):
    fn=D+f"chip_{c['id']}.jpg"
    if not os.path.exists(fn): continue
    im=Image.open(fn); dd=ImageDraw.Draw(im); W=box(c['E']-300,c['N']-300,c['E']+300,c['N']+300)
    vig=VA if c['frame']=='wgs' else VT
    for g in vig:
      if g.intersects(W): draw_poly(dd,g,c,c['E'],c['N'],(255,60,60),2)
    eg=(EA if c['frame']=='wgs' else ET).get((c['n'],c['rol']))
    if eg is not None: draw_poly(dd,eg,c,c['E'],c['N'],(255,255,0),3)
    dd.rectangle([0,0,480,22],fill=(0,0,0)); dd.text((4,2),f"{c['id']} {c['n'][:26]} {c['libre']}ha",fill='white',font=f)
    sheet.paste(im,((i%4)*480,(i//4)*480))
  sheet.save(f'sheets/s{k:02d}.jpg',quality=80); k+=1
print(k,'hojas')
