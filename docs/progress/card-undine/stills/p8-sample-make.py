# 第8弾の袋の絵の見本(全18種類)。使い方: python3 p8-sample-make.py <作業フォルダ(p8.png・届いたカードのイラスト2枚)> <出力.png> 214,490,182,404,488,186
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S=sys.argv[1]; R='/home/user/monhero/monster-hero/images/monsters/'
im=Image.open(S+'/p8.png').convert('RGBA')
def trim(p):
  a=Image.open(p).convert('RGBA'); return a.crop(a.getchannel('A').getbbox())
def blend(a):
  # 袋の絵になじませる: 彩度と濃さを少し落とし、明るめに寄せ、ふちを薄く
  from PIL import ImageEnhance
  rgb=a.convert('RGB'); al=a.getchannel('A')
  rgb=ImageEnhance.Color(rgb).enhance(0.88); rgb=ImageEnhance.Contrast(rgb).enhance(0.92); rgb=ImageEnhance.Brightness(rgb).enhance(1.04)
  al=al.filter(ImageFilter.GaussianBlur(1.2))
  out=rgb.convert('RGBA'); out.putalpha(al); return out
def put(a,cx,bottom,h,shadow=False):
  w=round(a.width*h/a.height); a=a.resize((w,h),Image.LANCZOS)
  x=cx-w//2; y=bottom-h
  if shadow:
    sh=Image.new('RGBA',a.size,(255,255,255,0)); sh.putalpha(a.getchannel('A').filter(ImageFilter.GaussianBlur(3)).point(lambda v:min(255,int(v*0.9))))
    glow=Image.new('RGBA',a.size,(255,255,255,255)); glow.putalpha(sh.getchannel('A'))
    for dx,dy in [(-2,0),(2,0),(0,-2),(0,2)]: im.alpha_composite(glow,(x+dx,y+dy))
  # 影: 下に薄い紫の影(まわりの光の色)
  sh=Image.new('RGBA',a.size,(60,40,90,0)); sh.putalpha(a.getchannel('A').filter(ImageFilter.GaussianBlur(5)).point(lambda v:int(v*0.35)))
  im.alpha_composite(sh,(x+3,y+4))
  im.alpha_composite(blend(a),(x,y))
un=trim(S+'/undine-stand-from-president.png'); sn=trim(S+'/snegurachka-stand-from-president.png')
cfg=[float(v) for v in sys.argv[3].split(',')] if len(sys.argv)>3 else [232,478,150,392,478,140]
put(un,int(cfg[0]),int(cfg[1]),int(cfg[2])); put(sn,int(cfg[3]),int(cfg[4]),int(cfg[5]))
# 「全12種類」の「2」を「8」に
d=ImageDraw.Draw(im)
box=(126,679,142,703)
px=im.load()
# 背景: 字の外の左右の列の色で、行ごとに塗る
for y in range(box[1],box[3]+1):
  l=px[box[0]-1,y]; r=px[box[2]+1,y]
  for x in range(box[0],box[2]+1):
    t=(x-box[0])/(box[2]-box[0]); px[x,y]=tuple(int(l[i]*(1-t)+r[i]*t) for i in range(4))
# 字の色は「1」の明るい点から
cols=[px[x,y] for x in range(113,125) for y in range(681,702) if sum(px[x,y][:3])>450]
col=tuple(sorted(cols,key=lambda c:sum(c[:3]))[len(cols)//2][:3])+(255,)
f=ImageFont.truetype('/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',36)
g=Image.new('L',(60,60),0); ImageDraw.Draw(g).text((10,5),'8',font=f,fill=255,stroke_width=1,stroke_fill=255)
g=g.crop(g.getbbox()); th=21; g=g.resize((round(g.width*th/g.height),th),Image.LANCZOS)
gl=Image.new('RGBA',g.size,col); gl.putalpha(g)
im.alpha_composite(gl,(134-g.width//2,681))
im.save(sys.argv[2])
z=im.crop((60,665,250,715)).resize((760,200),Image.NEAREST); z.save(sys.argv[2].replace('.png','-zoom.png'))
