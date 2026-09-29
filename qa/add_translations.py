"""Attach attributed Chinese Tatoeba translations to selected English examples."""
import bz2
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'data/examples.json'
examples = json.loads(path.read_text())
english_ids = {item['id'] for group in examples.values() for item in group}
chinese = {}
with bz2.open('/tmp/english-quest-tatoeba-cmn-detailed.tsv.bz2', 'rt', encoding='utf8') as source:
    for line in source:
        fields = line.rstrip('\n').split('\t')
        if len(fields) >= 4:
            chinese[int(fields[0])] = (fields[2], fields[3])

linked = {}
process = subprocess.Popen(['tar', '-xOjf', '/tmp/english-quest-tatoeba-links.tar.bz2', 'links.csv'], stdout=subprocess.PIPE, text=True)
for line in process.stdout:
    try:
        left, right = (int(x) for x in line.rstrip('\n').split('\t'))
    except ValueError:
        continue
    if left in english_ids and right in chinese:
        linked.setdefault(left, right)
    elif right in english_ids and left in chinese:
        linked.setdefault(right, left)
if process.wait():
    raise RuntimeError('links export failed')

count = 0
for group in examples.values():
    for item in group:
        cid = linked.get(item['id'])
        if cid:
            item['translation'] = chinese[cid][0]
            item['translationId'] = cid
            item['translationAuthor'] = chinese[cid][1]
            count += 1
curated = json.loads((root / 'data/curated_examples.json').read_text())
word_ids = {w['word']: str(w['id']) for w in json.loads((root / 'data/words.json').read_text())}
for word, pairs in curated.items():
    examples[word_ids[word]] = [{'text': en, 'translation': zh, 'source': 'original'} for en, zh in pairs]
path.write_text(json.dumps(examples, ensure_ascii=False, separators=(',', ':')))
print(f'{count} / {len(english_ids)} examples have linked Chinese translations')
print(f'{sum(all("translation" in item for item in group[:2]) for group in examples.values())} words have two translated examples')
