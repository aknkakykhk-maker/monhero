# 立ち絵(配信するもの)の上に、マスクの部位の境目を1pxの線で重ね、原寸の2倍で切り出して並べる
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFont
n,mask,out,font=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]
art=Image.open(f'../wt-ko/monster-hero/images/monsters/{n}.png').convert('RGBA')
m=np.array(Image.open(mask).convert('RGBA'))
assert art.size==(m.shape[1],m.shape[0]), ('大きさが違う',art.size,m.shape)
COL={(255,0,0):1,(0,255,0):2,(0,0,255):3,(255,255,0):4,(255,0,255):5}
lab=np.zeros(m.shape[:2],int)
for c,k in COL.items(): lab[(m[...,0]==c[0])&(m[...,1]==c[1])&(m[...,2]==c[2])&(m[...,3]>0)]=k
edge=np.zeros_like(lab,bool)
edge[:,1:]|=lab[:,1:]!=lab[:,:-1]; edge[1:,:]|=lab[1:,:]!=lab[:-1,:]
bg=Image.new('RGBA',art.size,(60,52,80,255)); bg.alpha_composite(art); a=np.array(bg)
# 境目の線は、どの部位の境目か分かるように、内側(その画素の部位)の色で描く。染めない所の側は白
LC={0:(255,255,255),1:(255,40,40),2:(40,255,40),3:(60,120,255),4:(255,240,0),5:(255,60,255)}
for k,c in LC.items(): a[edge&(lab==k),:3]=c
im=Image.fromarray(a)
W,H=im.size
areas=[x.split(':') for x in sys.argv[5].split(';')]
f=ImageFont.truetype(font,20)
crops=[]
for name,b in areas:
    x0,y0,x1,y1=[float(v) for v in b.split(',')]
    c=im.crop((int(W*x0),int(H*y0),int(W*x1),int(H*y1))); c=c.resize((c.width*2,c.height*2),Image.NEAREST)
    crops.append((name,c))
cols=3; cw=max(c.width for _,c in crops); ch=max(c.height for _,c in crops)
rows=(len(crops)+cols-1)//cols
sheet=Image.new('RGB',(cols*(cw+10)+10,rows*(ch+40)+10),(20,16,32)); d=ImageDraw.Draw(sheet)
for i,(name,c) in enumerate(crops):
    x=10+(i%cols)*(cw+10); y=10+(i//cols)*(ch+40)
    sheet.paste(c.convert('RGB'),(x,y+30)); d.text((x,y+4),name+'(原寸の2倍)',font=f,fill=(255,231,168))
sheet.save(out); print(out,sheet.size)
