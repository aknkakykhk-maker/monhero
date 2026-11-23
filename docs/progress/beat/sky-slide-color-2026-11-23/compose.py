# ゲーム本体の止め絵(game/*.png)を前・後で並べた1枚にする: python3 docs/progress/beat/sky-slide-color-2026-11-23/compose.py
import os,subprocess
from PIL import Image,ImageDraw,ImageFont
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),'game'))
f=ImageFont.truetype(subprocess.run(['fc-match','-f','%{file}',':lang=ja'],capture_output=True,text=True).stdout,22)
songs=[('grievous_lady','Grievous Lady HELL 12.95秒(左右同時・空中→地上)'),('sheriruth','Sheriruth HELL 26.65秒(地上→空中)'),('beyond_the_same_sky','Beyond the Same Sky HELL 24.55秒(空中だけ)')]
for o in ['yoko','tate']:
  ims=[[Image.open(f'{s}-{o}-{v}.png').convert('RGB') for v in ('before','after')] for s,_ in songs]
  w,h=ims[0][0].size;top=40;lab=34;gap=12
  out=Image.new('RGB',(w*2+20,top+(lab+h+gap)*3),(11,16,32));d=ImageDraw.Draw(out)
  d.text((8,8),'前(本番: 青=左手・桃=右手)',font=f,fill='white');d.text((w+28,8),'後(白い線がある所=桃・ない所=青)',font=f,fill='white')
  for i,(s,t) in enumerate(songs):
    y=top+i*(lab+h+gap);d.text((8,y+4),t,font=f,fill=(250,204,21))
    out.paste(ims[i][0],(0,y+lab));out.paste(ims[i][1],(w+20,y+lab))
  out.save(f'../game-{o}.jpg',quality=85)
