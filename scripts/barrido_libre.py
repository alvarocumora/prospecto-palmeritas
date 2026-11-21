import json,pickle,os,sys
from PIL import Image,ImageDraw,ImageFont
from shapely.geometry import box
from shapely.ops import unary_union
from shapely import affinity
chips={c['id']:c for c in json.load(open('chips.json'))}; D='chipsimg/'
RA=pickle.load(open('ca_cat2.pkl','rb')); L=pickle.load(open('elim.pkl','rb')); C=pickle.load(open('cat_1811.pkl','rb'))
VA=[r['g'] for r in RA if r['sit']!='ELIMINADA']; VT=[affinity.translate(r['g'],-200,-325) for r in C]
EA={(r['n'],r['rol']):r['g'] for r in RA if r['sit']=='ELIMINADA'}; ET={(r['n'],r['rol']):affinity.translate(r['g'],-200,-325) for r in L}
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',15)
ids=sys.argv[2].split(','); out=sys.argv[1]
res={}
sheet=Image.new('RGB',(4*480,((len(ids)+3)//4)*480),'black')
for i,cid in enumerate(ids):
  c=chips[cid]; E,N=c['E'],c['N']; W=box(E-300,N-300,E+300,N+300)
  vig=VA if c['frame']=='wgs' else VT
  eg=(EA if c['frame']=='wgs' else ET)[(c['n'],c['rol'])]
  occ=unary_union([g for g in vig if g.intersects(eg.buffer(50))]) if any(g.intersects(eg) for g in vig) else None
  free=eg.difference(occ) if occ is not None else eg
  res[cid]=free
  im=Image.open(D+f"chip_{cid}.jpg").convert('RGBA'); ov=Image.new('RGBA',im.size,(0,0,0,0)); od=ImageDraw.Draw(ov)
  T=lambda x,y:((x-(E-300))/600*480,(N+300-y)/600*480)
  for p in getattr(free,'geoms',[free]):
    if p.geom_type=='Polygon' and p.area>100: od.polygon([T(*q) for q in p.exterior.coords],fill=(0,255,0,55),outline=(0,255,0,255))
  im=Image.alpha_composite(im,ov).convert('RGB'); dd=ImageDraw.Draw(im)
  dd.rectangle([0,0,480,22],fill=(0,0,0)); dd.text((4,2),f"{cid} {c['n'][:24]} libre {free.area/1e4:.1f}ha",fill='white',font=f)
  sheet.paste(im,((i%4)*480,(i//4)*480))
sheet.save(out,quality=80)
pickle.dump(res,open(out+'.pkl','wb'))
