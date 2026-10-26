import sys, numpy as np
from PIL import Image
n,mask,out=sys.argv[1],sys.argv[2],sys.argv[3]; boxes=[[float(v) for v in b.split(',')] for b in sys.argv[4].split(';')]
art=Image.open(f'../wt-ko/monster-hero/images/monsters/{n}.png').convert('RGBA')
m=np.array(Image.open(mask).convert('RGBA'))
COL={(255,0,0):1,(0,255,0):2,(0,0,255):3,(255,255,0):4,(255,0,255):5}
lab=np.zeros(m.shape[:2],int)
for c,k in COL.items(): lab[(m[...,0]==c[0])&(m[...,1]==c[1])&(m[...,2]==c[2])&(m[...,3]>0)]=k
edge=np.zeros_like(lab,bool); edge[:,1:]|=lab[:,1:]!=lab[:,:-1]; edge[1:,:]|=lab[1:,:]!=lab[:-1,:]
bg=Image.new('RGBA',art.size,(60,52,80,255)); bg.alpha_composite(art); a=np.array(bg)
a2=a.copy(); a2[edge,:3]=(0,255,255)
W,H=art.size; outs=[]
for x0,y0,x1,y1 in boxes:
    box=(int(W*x0),int(H*y0),int(W*x1),int(H*y1)); sz=((box[2]-box[0])*4,(box[3]-box[1])*4)
    c1=Image.fromarray(a).crop(box).resize(sz,Image.NEAREST); c2=Image.fromarray(a2).crop(box).resize(sz,Image.NEAREST)
    s=Image.new('RGBA',(c1.width*2+8,c1.height),(0,0,0,255)); s.paste(c1,(0,0)); s.paste(c2,(c1.width+8,0)); outs.append(s)
H2=sum(o.height+8 for o in outs); W2=max(o.width for o in outs)
sh=Image.new('RGB',(W2,H2),(0,0,0)); y=0
for o in outs: sh.paste(o.convert('RGB'),(0,y)); y+=o.height+8
sh.save(out)
