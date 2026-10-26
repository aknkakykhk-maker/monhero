import sys,numpy as np
from PIL import Image
from scipy import ndimage as nd
m=np.array(Image.open(sys.argv[1]).convert('RGBA'))
COL={(255,0,0):1,(0,255,0):2,(0,0,255):3,(255,255,0):4,(255,0,255):5}
lab=np.zeros(m.shape[:2],int)
for c,k in COL.items(): lab[(m[...,0]==c[0])&(m[...,1]==c[1])&(m[...,2]==c[2])&(m[...,3]>0)]=k
H,W=lab.shape; runs=[]
v=(lab[:,1:]!=lab[:,:-1])
for x in range(v.shape[1]):
    lbl,n=nd.label(v[:,x])
    for i in range(1,n+1):
        ys=np.where(lbl==i)[0]
        if len(ys)>=12: runs.append((len(ys),'x',x,ys[0],ys[-1],lab[ys[0],x],lab[ys[0],x+1]))
hz=(lab[1:,:]!=lab[:-1,:])
for y in range(hz.shape[0]):
    lbl,n=nd.label(hz[y])
    for i in range(1,n+1):
        xs=np.where(lbl==i)[0]
        if len(xs)>=12: runs.append((len(xs),'y',y,xs[0],xs[-1],lab[y,xs[0]],lab[y+1,xs[0]]))
for r in sorted(runs,key=lambda r:-r[0])[:int(sys.argv[2]) if len(sys.argv)>2 else 12]: print(r)
