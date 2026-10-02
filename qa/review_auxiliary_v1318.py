"""Apply the v1.31.8 auxiliary quality layer after all older editing layers."""
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
wp,ep=ROOT/'data/words.json',ROOT/'data/examples.json'
words,examples=json.loads(wp.read_text()),json.loads(ep.read_text())
p=json.loads((ROOT/'qa/reviewed_auxiliary_v1318.json').read_text())
assert p['status']=='frozen_after_root_cross_review'
seen=set()
for c in p['changes']:
 wid,field=c['word_id'],c['field'];w=words[wid-1]
 assert w['id']==wid and w['word']==c['word']
 assert field in ('gloss','en','phonetic','text','translation')
 index=c.get('example_index');key=(wid,field,index)
 assert key not in seen;seen.add(key)
 obj=w if index is None else examples[str(wid)][index]
 name='zh' if field=='gloss' else field
 assert obj[name] in (c['before'],c['after']),key
 if field=='gloss':
  assert w['full'].startswith('常用：'+w['zh']+'\n'),key
  w['full']='常用：'+c['after']+'\n'+w['full'].split('\n',1)[1]
 elif index is not None:
  assert obj.get('source')=='original' and not obj.get('id'),key
 obj[name]=c['after']
print('Validated %d auxiliary corrections on %d stable word IDs.'%(len(p['changes']),len({c['word_id'] for c in p['changes']})))
if '--apply' in sys.argv:
 wp.write_text(json.dumps(words,ensure_ascii=False,separators=(',',':')))
 ep.write_text(json.dumps(examples,ensure_ascii=False,separators=(',',':')))
 print('Applied after validating all before/after values; original dictionary tails preserved.')
else:print('Preview only; --apply writes the verified quality layer.')
