import json,pathlib,re
p=pathlib.Path(__file__).parent
missions=[]
for line in (p/'data/scenarios.txt').read_text().splitlines():
 if line.startswith('['):
  track,name,num,title,difficulty=line[1:-1].split('|')
  m=dict(id=track+num,track=track,trackName=name,title=title,difficulty=int(difficulty),items=[]);missions.append(m)
 else:
  phrase,zh,sentence,translation=line.split('|')
  assert phrase.lower() in sentence.lower(),(phrase,sentence)
  m['items'].append(dict(id=f"p{sum(len(x['items']) for x in missions)+1}",word=phrase,zh=zh,full=zh,sentence=sentence,translation=translation,phonetic='',en=''))
assert len(missions)==12 and all(len(m['items'])==10 for m in missions)
(p/'data/scenarios.json').write_text(json.dumps(missions,ensure_ascii=False,separators=(',',':')))
print('12 missions, 120 original scenario entries')
