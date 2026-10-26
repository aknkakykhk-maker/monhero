# 下書き(部位)から配信用の染色マスクを作る。輪郭線はまわりが1つの部位だけならその部位へ、ちらばりは多数決で消す
import numpy as np, sys
from PIL import Image
from scipy import ndimage as nd
name,rules,out=sys.argv[1],sys.argv[2],sys.argv[3]
im=np.array(Image.open(name+'-ana.png').convert('RGBA')).astype(float)
H,Wd=im.shape[:2]; rgb=im[...,:3]/255; a=im[...,3]
mx=rgb.max(-1); mn=rgb.min(-1); v=mx; s=np.where(mx>0,(mx-mn)/np.maximum(mx,1e-6),0)
r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]; d=np.maximum(mx-mn,1e-6)
h=np.where(mx==r,(g-b)/d%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60; h=np.where(mx==mn,0,h)
yy,xx=np.mgrid[0:H,0:Wd]; X=xx/Wd; Y=yy/H
lab=np.zeros((H,Wd),int); op=a>40
def box(x0,y0,x1,y1): return (X>=x0)&(X<x1)&(Y>=y0)&(Y<y1)
from scipy import ndimage as nd
exec(open(rules).read())
# 多数決(5x5)でちらばりを消す。染めない(0)は顔・小物の形を保つため、多数決の前後で動かさない
zero=op&(lab==0)
cnt=np.stack([nd.uniform_filter((lab==k).astype(float),5) for k in range(6)]); cnt[0]=-1
maj=cnt.argmax(0)
lab=np.where(op&~zero,maj,lab)
# 輪郭線: 部位が決まっていない暗い画素(染めない所の中は除く)を、3px以内のいちばん近い部位で埋める
line=op&(v<0.35)&(lab==0)
src=(lab>0)
dist,(iy,ix)=nd.distance_transform_edt(~src,return_indices=True)
fill=line&(dist<=3)
lab=np.where(fill,lab[iy,ix],lab)
lab=np.where(a>8,lab,0)
# 境目を絵の線へ吸い寄せる(2026-10-27 社長「マスクずれてる」)。
# 各部位(染めない所も)の内側 B px は確かな所として残し、境目のまわりだけを、絵の明るさ・色の変わり目が
# いちばん強い所で分かれるように、確かな所から低い所順に広げ直す(優先度つきの塗り広げ)
import heapq
SNAPB=globals().get('SNAPB',6); LINEW=globals().get('LINEW',0)
def snap(lab,B=None):
    B=B or SNAPB
    rgbf=rgb*255
    gm=np.zeros((H,Wd))
    for c in range(3):
        gm=np.maximum(gm,np.hypot(nd.sobel(rgbf[...,c],0),nd.sobel(rgbf[...,c],1)))
    # 淡い絵の細い輪郭線(両わきより少し暗い線)を強める。明るさの変わり目だけだと、パステルの髪の線を拾えない
    lum=(0.3*rgb[...,0]+0.59*rgb[...,1]+0.11*rgb[...,2])*255
    sat=s*255
    bh=nd.grey_closing(lum,size=(5,5))-lum
    bs=sat-nd.grey_opening(sat,size=(5,5))
    gm=gm+LINEW*(bh+bs)
    sure=np.zeros((H,Wd),bool)
    for k in range(6):
        reg=(lab==k)&op
        sure|=nd.binary_erosion(reg,iterations=B)&reg
    out=np.where(sure,lab,-1); out=np.where(op,out,0)
    hp=[]
    ys,xs=np.nonzero(sure)
    for y,x in zip(ys,xs):
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            Y,X=y+dy,x+dx
            if 0<=Y<H and 0<=X<Wd and out[Y,X]==-1: heapq.heappush(hp,(gm[Y,X],Y,X,out[y,x]))
    while hp:
        g,y,x,k=heapq.heappop(hp)
        if out[y,x]!=-1: continue
        out[y,x]=k
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            Y,X=y+dy,x+dx
            if 0<=Y<H and 0<=X<Wd and out[Y,X]==-1: heapq.heappush(hp,(gm[Y,X],Y,X,k))
    return np.where(out<0,lab,out)
if 'NOSNAP' not in dir(): lab=snap(lab)
if 'KEEPZERO' in dir(): lab[KEEPZERO]=0
lab=np.where(a>8,lab,0)
COL={1:(255,0,0),2:(0,255,0),3:(0,0,255),4:(255,255,0),5:(255,0,255)}
o=np.zeros((H,Wd,4),np.uint8)
for k,c in COL.items(): m=lab==k; o[m,:3]=c; o[m,3]=255
Image.fromarray(o).save(out)
print(name,{k:int((lab==k).sum()) for k in range(6)})
