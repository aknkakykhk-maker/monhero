# 歌い分けの区間の表を作る(2026-11-22・台帳 r1119-096 追記)。
#   python3 tools/audio/vocal-parts-table.py <声の主の json(原曲)> <出力 json> <出力 md>
# 区切りは、社長がくれた歌詞(vocal-split/lyrics-parts.txt)の並びを、声の主で分けた結果(vocal-split-speaker.py)と小節(BPM178・1小節1.348秒)へ当てて人が決めた。
# 確かさ = その区間の0.5秒ごとの声の主が、歌詞の声と合っている割合(2人・ハモりの区間は出さない)。
# 短い版は、音の似かた(クロマ+MFCC)で割り出した対応で写す: 0〜107.8秒は原曲と同じ / 107.8〜134.0秒は原曲の+59.7秒 / 135.5秒〜は原曲の+103.6秒
import sys, json
spk = json.load(open(sys.argv[1]))['rows']
F,M,FM,B,I = '女声','男声','女声(男声の低い重ね)','2人','間奏'
FULL = [
 (0.0,3.4,I,'[Short Dramatic Intro]'),
 (3.4,23.6,F,'知らない街を駆け抜けて〜いつも君が笑っていた'),
 (23.6,35.8,M,'傷だらけの剣を握り〜君が帰る場所をくれた'),
 (35.8,38.5,F,'雨に濡れた夜も'),(38.5,41.9,M,'朝まで笑った日も'),(41.9,44.0,F,'何度迷ったとしても'),
 (44.0,48.0,M,'君の隣へ帰るから'),(48.0,50.1,F,'もう怖くない'),(50.1,51.9,M,'俺も離さない'),
 (51.9,57.3,FM,'同じ空を越えてゆこう 涙さえ振り切るように'),(57.3,62.7,M,'どんな夜が待っていても 必ず君を見つける'),
 (62.7,68.1,FM,'世界の果てまで続く道 君となら怖くないから'),(68.1,73.5,M,'運命なんて変えればいい この手だけは離さない'),
 (73.5,84.3,B,'幾千の夜を越えた先 二人で未来を見つけよう(2人)'),(84.3,89.7,B,'Beyond the Same Sky(ハモり)'),
 (89.7,92.4,I,'[Short Instrumental Transition]'),
 (92.4,103.5,F,'焚き火を囲んだあの夜〜朝が来るまで笑ってた'),(103.5,113.9,M,'勝てない敵に挑んでは〜振り向けば君がいたから'),
 (113.9,116.0,M,'戻れなくても'),(116.0,119.8,F,'それでもいいよ'),(119.8,122.7,M,'この先が闇でも'),(122.7,125.3,F,'私は君を信じる'),
 (125.3,127.8,M,'世界じゃなくて'),(127.8,131.0,F,'君を選びたい'),
 (131.0,146.5,F,'もしもあの日 出会わなければ〜知らなかった'),(146.5,153.8,M,'もしもあの日 君がいなければ〜ここにいなかった'),
 (153.8,160.9,F,'好きになれてよかった'),(160.9,164.1,M,'出会えてよかった'),(164.1,168.2,B,'だからもう一度 あの空の先へ(2人)'),
 (168.2,173.6,FM,'同じ空を越えてゆけ あの日の涙を抱きしめて'),(173.6,187.2,M,'たとえ世界が変わっても 俺は君を探しに行く'),
 (187.2,194.6,F,'たとえ時が二人を隔てても 私は君を忘れない(歌詞の札は男声。音は女声だったので女声)'),
 (194.6,200.6,M,'もう一度出会えるなら 何度だって旅に出よう'),(200.6,205.8,F,'あの日見上げた空の向こうへ'),(205.8,209.4,M,'まだ見ぬ明日のその先へ'),
 (209.4,220.5,B,'傷も涙も全部連れて 二人で未来へ駆け抜けよう(ハモり)'),(220.5,228.6,B,'Beyond the Same Sky(2人)'),
 (228.6,236.0,I,'[Short Outro]'),(236.0,243.5,F,'ねぇ 次はどこへ行こうか'),(243.5,245.8,M,'君となら どこまでも'),(245.8,257.0,B,'同じ空の先へ(ハモり)'),
]
def conf(s,e,k):
  want = '低' if k==M else ('高' if k in (F,FM) else None)
  if not want: return None
  rs=[r for r in spk if s<=r['t']<e and r['who']]
  return round(sum(r['who']==want for r in rs)/len(rs),2) if rs else None
full=[{'start':s,'end':e,'voice':k,'lyrics':l,'conf':conf(s,e,k)} for s,e,k,l in FULL]
MAP=[(0.0,107.8,0.0),(107.8,134.0,59.7),(135.5,153.4,103.6)]
short=[]
for a,b,off in MAP:
  for r in full:
    s,e=max(r['start'],a+off),min(r['end'],b+off)
    if e-s>=0.3: short.append({**r,'start':round(s-off,1),'end':round(e-off,1),'full':[round(s,1),round(e,1)]})
json.dump({'full':full,'short':short,'shortMap':MAP},open(sys.argv[2],'w'),ensure_ascii=False,indent=0)
def md(rows,short=False):
  L=['| 秒 | 声 | 確かさ | 歌詞 |'+(' 原曲の秒 |' if short else ''),'| --- | --- | --- | --- |'+(' --- |' if short else '')]
  for r in rows: L.append(f"| {r['start']:.1f}–{r['end']:.1f} | {r['voice']} | {'' if r['conf'] is None else r['conf']} | {r['lyrics']} |"+(f" {r['full'][0]}–{r['full'][1]} |" if short else ''))
  return '\n'.join(L)
open(sys.argv[3],'w').write('# Beyond the Same Sky 歌い分けの区間の表(2026-11-22)\n\n社長がくれた歌詞の札(`lyrics-parts.txt`)を、抜き出した声の主の分け方と小節に当てた。確かさ=0.5秒ごとの声の主が歌詞の声と合う割合(2人・間奏は空欄)。作り方は [README.md](README.md)。\n\n## 原曲\n\n'+md(full)+'\n\n## short ver.\n\n'+md(short,True)+'\n')
ok=[r['conf'] for r in full if r['conf'] is not None]
print('区間',len(full),'短い版',len(short),'確かさの平均',round(sum(ok)/len(ok),2),'0.6未満',[(r['start'],r['voice'],r['conf']) for r in full if r['conf'] is not None and r['conf']<0.6])
