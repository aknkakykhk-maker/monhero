import sys,numpy as np
from PIL import Image
x0,y0,x1,y1=[float(v) for v in sys.argv[1:5]]; out=sys.argv[5]
art=Image.open('../wt-ko/monster-hero/images/monsters/orihime.png').convert('RGBA'); m=np.array(Image.open('orihime-mask-v4.png').convert('RGBA')).astype(float)
bg=Image.new('RGBA',art.size,(60,52,80,255)); bg.alpha_composite(art); a=np.array(bg).astype(float)
al=(m[...,3:4]>0)*0.5; o=Image.fromarray((a[...,:3]*(1-al)+m[...,:3]*al).astype(np.uint8))
W,H=o.size; bb=(int(W*x0),int(H*y0),int(W*x1),int(H*y1)); sz=((bb[2]-bb[0])*4,(bb[3]-bb[1])*4)
c=o.crop(bb).resize(sz,Image.NEAREST); c1=bg.crop(bb).resize(sz,Image.NEAREST).convert('RGB')
s=Image.new('RGB',(sz[0]*2+8,sz[1])); s.paste(c1,(0,0)); s.paste(c,(sz[0]+8,0)); s.save(out); print(bb)
