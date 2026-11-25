# 使い方: pair.py <出力> <顔の置き場(例 halloween/face/momosuke)> <名前> [基準の置き場 基準の名前 ...]
import sys,io,subprocess,os
from PIL import Image,ImageDraw,ImageFont
A='monster-hero/images/assistant/'
EX=['normal','happy','wink','surprise','troubled','angry','crying','excited']
fp='/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'
font=ImageFont.truetype(fp,18) if os.path.exists(fp) else ImageFont.load_default()
S=150;P=12;L=150
def circ(im):
  im=im.convert('RGBA').resize((S,S),Image.LANCZOS);bg=Image.new('RGBA',(S,S),(255,250,240,255));bg.alpha_composite(im)
  m=Image.new('L',(S,S),0);ImageDraw.Draw(m).ellipse((0,0,S-1,S-1),fill=255);return bg.convert('RGB'),m
out_p,path,name=sys.argv[1:4];refs=sys.argv[4:]
rows=[('前(main)',lambda e:Image.open(io.BytesIO(subprocess.check_output(['git','show','origin/main:'+A+path+'_'+e+'.PNG']))))]
rows.append(('後',lambda e:Image.open(A+path+'_'+e+'.PNG')))
for i in range(0,len(refs),2):
  rp,rn=refs[i],refs[i+1];rows.append(('基準 '+rn,(lambda rp:lambda e:Image.open(A+rp+'_'+e+'.PNG'))(rp)))
W=L+len(EX)*(S+P)+P;H=40+len(rows)*(S+P)+P
o=Image.new('RGB',(W,H),(236,232,224));d=ImageDraw.Draw(o)
d.text((P,8),name+'  (赤線=丸の真ん中・青線=上下10%)',fill=(0,0,0),font=font)
for j,e in enumerate(EX): d.text((L+j*(S+P),H-0),'',fill=0)
for r,(lab,get) in enumerate(rows):
  y=40+r*(S+P);d.text((P,y+S/2-10),lab,fill=(0,0,0),font=font)
  for j,e in enumerate(EX):
    x=L+j*(S+P)
    try: c,m=circ(get(e))
    except Exception: continue
    o.paste(c,(x,y),m)
    for f,col in ((0.4,(120,120,255)),(0.5,(255,0,0)),(0.6,(120,120,255))): d.line((x,y+S*f,x+S,y+S*f),fill=col)
    d.line((x+S/2,y,x+S/2,y+S),fill=(255,0,0))
o.save(out_p)
