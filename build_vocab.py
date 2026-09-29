import csv,json,re,hashlib,pathlib,collections
root=pathlib.Path(__file__).parent
source=pathlib.Path('/tmp/english-ecdict-full.csv')
rows=list(csv.DictReader(source.open(encoding='utf-8')))
by={r['word']:r for r in rows}
def eligible(r):
 w=r['word']
 if not re.fullmatch('[a-z]{2,22}',w) or not re.search('[\u4e00-\u9fff]',r['translation']):return False
 lemma=re.search(r'(?:^|/)0:([^/]+)',r['exchange'])
 if lemma and lemma[1]!=w and lemma[1] in by:return False
 if re.search('人名|姓氏|地名|男子名|女子名|的复数|的过去式|的现在分词|的过去分词|的第三人称',r['translation']):return False
 return int(r['frq'] or 0)>0 or int(r['bnc'] or 0)>0
pool=[r for r in rows if eligible(r)]
rank=lambda r:int(r['frq'] or 0) or int(r['bnc'] or 0) or 999999
pool.sort(key=rank)
intro='hello world name good day time yes no please thank water food coffee tea bread rice fruit milk eat drink go come work home room door open close help need want like see look read write speak listen learn word book phone map road city country travel ticket train bus flight hotel check friend happy new old small big long short easy hard start finish first last next today tomorrow morning night one two three four five six seven eight nine ten computer code file save error fix test build run use make create image video sound light color story idea plan'.split()
selected=[];seen=set()
for w in intro:
 r=by.get(w)
 if r and re.search('[\u4e00-\u9fff]',r['translation']) and w not in seen:selected.append(r);seen.add(w)
for r in pool:
 if r['word'] not in seen:selected.append(r);seen.add(r['word'])
 if len(selected)==20000:break
assert len(selected)==20000
basic_text="""hello|你好；喂
world|世界
name|名字；名称
good|好的；不错的
day|一天；白天
time|时间；次数
yes|是的
no|不；不是
please|请
thank|感谢
water|水
food|食物
coffee|咖啡
tea|茶
bread|面包
rice|米饭；稻米
fruit|水果
milk|牛奶
eat|吃
drink|喝；饮料
go|去；走
come|来
work|工作
home|家
room|房间
door|门
open|打开；开着的
close|关闭；关上
help|帮助
need|需要
want|想要
like|喜欢
see|看见
look|看
read|阅读
write|写
speak|说话
listen|听
learn|学习
word|单词
book|书
phone|电话；手机
map|地图
road|道路
city|城市
country|国家
travel|旅行
ticket|票
train|火车
bus|公共汽车
flight|航班；飞行
hotel|旅馆；酒店
check|检查；核对
friend|朋友
happy|高兴的
new|新的
old|旧的；年老的
small|小的
big|大的
long|长的
short|短的
 easy|容易的
hard|困难的；坚硬的
start|开始
finish|完成；结束
first|第一；首先
last|最后的；上一个
next|下一个
today|今天
tomorrow|明天
morning|早晨
night|夜晚
one|一
two|二
three|三
four|四
five|五
six|六
seven|七
eight|八
nine|九
ten|十
computer|计算机；电脑
code|代码
file|文件
save|保存
error|错误
fix|修复
 test|测试
build|构建；建造
run|运行；跑
use|使用
make|制作
create|创造；创建
image|图像
video|视频
sound|声音
light|光；灯
color|颜色
story|故事
idea|想法
plan|计划"""
basic=dict(line.strip().split('|') for line in basic_text.splitlines())
words=[]
for i,r in enumerate(selected):
 lines=r['translation'].replace('\\n','\n').splitlines()
 meaning='；'.join(lines[:2])
 # Keep complete short senses for choices; full dictionary meaning remains on feedback.
 short=re.sub(r'\[[^\]]*\]','',lines[0]).strip()
 if len(short)>68:short=','.join(short.split(',')[:3])
 definition=r['definition'].replace('\\n','\n').splitlines()[0] if r['definition'] else ''
 definition=re.sub(r'^\S+\.\s*','',definition).strip()
 if re.search(r'\b'+re.escape(r['word'])+r'\b',definition,re.I):definition=''
 short=basic.get(r['word'],short)
 words.append(dict(id=i+1,word=r['word'],zh=short,full=('常用：'+short+'\n' if r['word'] in basic else '')+r['translation'].replace('\\n','\n'),phonetic=r['phonetic'],en=definition,rank=rank(r),chapter=i//1000+1))
(root/'data/words.json').write_text(json.dumps(words,ensure_ascii=False,separators=(',',':')))
manifest=dict(source='https://github.com/skywind3000/ECDICT',source_file='ecdict.csv',source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),license='MIT',count=len(words),unique=len({w['word'] for w in words}),levels=2000,chapter_count=20,selection='Frequency ordered; exclude explicit inflection lemmas and proper-name translations; first 100 words hand selected; derived lexemes count separately, not as word families.',qa='Structural checks passed; source definitions are not individually editorially reviewed.',generated_at='2026-09-29')
(root/'provenance/vocabulary.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps({'words':len(words),'eligible':len(pool),'first':words[0],'last':words[-1]},ensure_ascii=False))
