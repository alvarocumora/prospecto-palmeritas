import pickle,json,numpy as np
from rasterio.features import rasterize
from rasterio.transform import from_origin
from scipy import ndimage
allf=pickle.load(open('zona/cat_zona.pkl','rb'))
prev={c['rol'] for c in json.load(open('chips.json'))}
R=50
xs=[f['g'].bounds for f in allf]
x0=min(b[0] for b in xs);y0=min(b[1] for b in xs);x1=max(b[2] for b in xs);y1=max(b[3] for b in xs)
W=int((x1-x0)/R)+1;H=int((y1-y0)/R)+1;tr=from_origin(x0,y1,R,R)
print(W,H)
el=[f for f in allf if f['sit']=='ELIMINADA' and f['tipo']=='EXPLOTACION']
def w(f):
  ha=f['ha'] or f['g'].area/1e4
  return 1.0 if ha<=60 else (0.5 if ha<=150 else 0.25)
dep=np.zeros((H,W),np.float32)
for f in el:
  m=rasterize([(f['g'],1)],out_shape=(H,W),transform=tr,dtype='uint8')
  dep+=m*w(f)
vig=[f['g'] for f in allf if f['sit']!='ELIMINADA']
occ=rasterize([(g,1) for g in vig],out_shape=(H,W),transform=tr,dtype='uint8')
# area inside zonas only (coverage of any feature fetched) -> use bbox; also mask previously swept ones? keep
free=(occ==0)
S=dep*free
# local free area >=5ha within 300m window requirement
fa=ndimage.uniform_filter(free.astype(np.float32),size=13)  # 650m window fraction
S=S*(fa>0.12)
np.save('zona/S.npy',S); pickle.dump((x0,y1,R,W,H),open('zona/grid.pkl','wb'))
# greedy peaks
Sm=ndimage.uniform_filter(S,size=5)
pk=[];A=Sm.copy()
while len(pk)<420:
  i=np.argmax(A); v=A.flat[i]
  if v<0.6: break
  r,c=divmod(i,W); E=x0+c*R+R/2; N=y1-r*R-R/2
  pk.append((round(E),round(N),float(v)))
  A[max(0,r-12):r+13,max(0,c-12):c+13]=0
print(len(pk), pk[:5], pk[-1])
pickle.dump(pk,open('zona/peaks.pkl','wb'))
