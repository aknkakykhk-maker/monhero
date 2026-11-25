# normal だけ大きく: 前・後・基準を横に。目の線を探しやすいよう5%ごとに薄い線
import sys,io,subprocess
from PIL import Image,ImageDraw,ImageFont
A='monster-hero/images/assistant/';S=320;P=14
font=ImageFont.truetype('/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',20)
out=sys.argv[1];items=[]
args=sys.argv[2:]
for i in range(0,len(args),2):
  lab,src=args[i],args[i+1]
  im=Image.open(io.BytesIO(subprocess.check_output(['git','show',src]))) if ':' in src and src.startswith('origin') else Image.open(A+src)
  items.append((lab,im))
o=Image.new('RGB',(P+len(items)*(S+P),S+60),(236,232,224));d=ImageDraw.Draw(o)
for k,(lab,im) in enumerate(items):
  x=P+k*(S+P);y=10
  im=im.convert('RGBA').resize((S,S),Image.LANCZOS);bg=Image.new('RGBA',(S,S),(255,250,240,255));bg.alpha_composite(im)
  m=Image.new('L',(S,S),0);ImageDraw.Draw(m).ellipse((0,0,S-1,S-1),fill=255);o.paste(bg.convert('RGB'),(x,y),m)
  for f in range(4,17):
    ff=f*0.05;d.line((x,y+S*ff,x+S,y+S*ff),fill=(255,0,0) if f==10 else (150,150,255))
  d.line((x+S/2,y,x+S/2,y+S),fill=(255,0,0))
  d.text((x,y+S+8),lab,fill=(0,0,0),font=font)
o.save(out)
