# 顔アイコン(normal)を全組丸く切って並べる(r1125-023)。使い方: python3 tools/assistant/life-face-sheet.py <出力.png>
import sys
from PIL import Image, ImageDraw, ImageFont
A='monster-hero/images/assistant/'
G=[('mua','face/myua'),('mua:halloween','halloween/face/myua'),('mua:card-master','card-master/face/myua'),
 ('kiki','face/kiki'),('kiki:halloween','halloween/face/kiki'),('kiki:twintail*','twintail/face/kiki'),
 ('momosuke*','face/momosuke'),('momosuke:halloween','halloween/face/momosuke'),('kyuko*','face/kyuko'),('kyuko:winter','winter/face/kyuko'),
 ('sorashido','face/sorashido'),('sorashido:hosei*','hosei/face/sorashido'),('erubin*','face/erubin'),('erubin:sekiyuou*','sekiyuou/face/erubin'),('atsu','face/atsu'),('dra','face/dra')]
expr=sys.argv[2] if len(sys.argv)>2 else 'normal'
S=200;P=16;cols=4
font=ImageFont.truetype('/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',16) if __import__('os').path.exists('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc') else ImageFont.load_default()
rows=(len(G)+cols-1)//cols
W=cols*(S+P)+P;H=rows*(S+P+24)+P
out=Image.new('RGB',(W,H),(236,232,224));d=ImageDraw.Draw(out)
for i,(k,p) in enumerate(G):
  im=Image.open(A+p+'_'+expr+'.PNG').convert('RGBA');sz=im.size
  im=im.resize((S,S),Image.LANCZOS)
  bg=Image.new('RGBA',(S,S),(255,250,240,255));bg.alpha_composite(im)
  m=Image.new('L',(S,S),0);ImageDraw.Draw(m).ellipse((0,0,S-1,S-1),fill=255)
  x=P+(i%cols)*(S+P);y=P+(i//cols)*(S+P+24)
  out.paste(bg.convert('RGB'),(x,y),m)
  for f in (0.4,0.5,0.6): d.line((x,y+S*f,x+S,y+S*f),fill=(255,0,0) if f==0.5 else (120,120,255),width=1)
  d.line((x+S/2,y,x+S/2,y+S),fill=(255,0,0),width=1)
  d.text((x,y+S+2),'%s %dpx'%(k,sz[0]),fill=(0,0,0),font=font)
out.save(sys.argv[1])
