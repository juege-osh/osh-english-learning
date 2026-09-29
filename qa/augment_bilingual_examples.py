"""Candidate-first Tatoeba bilingual improvement; use --apply after editorial spot checks.

Uses the separately downloaded Tatoeba exports named below. Does not fetch data.
"""
import bz2
import collections
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORDS = json.loads((ROOT / 'data/words.json').read_text())
TARGETS = {w['word']: str(w['id']) for w in WORDS}
EXAMPLES = ROOT / 'data/examples.json'
ENGLISH = Path('/tmp/english-quest-tatoeba-eng.tsv.bz2')
CHINESE = Path('/tmp/english-quest-tatoeba-cmn-detailed.tsv.bz2')
LINKS = Path('/tmp/english-quest-tatoeba-links.tar.bz2')
TOKEN = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
CANDIDATES = collections.defaultdict(list)

# Keep a small range of short, everyday candidates per word before joining translations.
with bz2.open(ENGLISH, 'rt', encoding='utf8') as source:
    for line in source:
        fields = line.rstrip('\n').split('\t')
        if len(fields) < 4:
            continue
        sid, _lang, sentence, author = fields[:4]
        if not sentence.endswith(('.', '!', '?')) or not 12 <= len(sentence) <= 120:
            continue
        tokens = TOKEN.findall(sentence)
        if not 4 <= len(tokens) <= 17:
            continue
        lower = [t.lower() for t in tokens]
        for word in set(lower) & TARGETS.keys():
            if lower.count(word) != 1:
                continue
            # Prefer complete conversational length over two- or three-word fragments.
            length_penalty = abs(len(tokens) - 7)
            name_penalty = 5 if re.search(r'\b(Tom|Mary|Sami|Ziri|Tatoeba)\b', sentence) else 0
            score = (length_penalty + name_penalty, len(sentence), int(sid))
            items = CANDIDATES[word]
            items.append((score, int(sid), sentence, author))
            if len(items) > 80:
                items.sort()
                del items[40:]

for items in CANDIDATES.values():
    items.sort()
    del items[40:]
selected_ids = {item[1] for items in CANDIDATES.values() for item in items}
chinese = {}
with bz2.open(CHINESE, 'rt', encoding='utf8') as source:
    for line in source:
        fields = line.rstrip('\n').split('\t')
        if len(fields) >= 4:
            chinese[int(fields[0])] = (fields[2], fields[3])

linked = {}
process = subprocess.Popen(['tar', '-xOjf', str(LINKS), 'links.csv'], stdout=subprocess.PIPE, text=True)
for line in process.stdout:
    try:
        left, right = (int(x) for x in line.rstrip('\n').split('\t'))
    except ValueError:
        continue
    if left in selected_ids and right in chinese:
        linked.setdefault(left, right)
    elif right in selected_ids and left in chinese:
        linked.setdefault(right, left)
if process.wait():
    raise RuntimeError('links export failed')

examples = json.loads(EXAMPLES.read_text())
changed = 0
for word, word_id in TARGETS.items():
    if int(word_id) <= 100:
        continue
    original = examples[word_id]
    choices = []
    for score, sid, sentence, author in CANDIDATES[word]:
        cid = linked.get(sid)
        if cid:
            choices.append((score, {'id': sid, 'text': sentence, 'author': author,
                                    'translation': chinese[cid][0], 'translationId': cid,
                                    'translationAuthor': chinese[cid][1]}))
    # Existing translated examples may have fallen outside this pass's candidate window.
    for item in original:
        if item.get('translation') and item.get('source') != 'dialogue':
            choices.append(((0, len(item['text']), item.get('id', 0)), item))
    choices.sort(key=lambda pair: pair[0])
    picked = []
    for _score, item in choices:
        if item['text'] not in {x['text'] for x in picked}:
            picked.append(item)
        if len(picked) == 2:
            break
    for item in original:
        if len(picked) == 2:
            break
        if item['text'] not in {x['text'] for x in picked}:
            picked.append(item)
    if len(picked) == 2 and picked != original:
        changed += 1
        examples[word_id] = picked

before = json.loads(EXAMPLES.read_text())
for limit in (100, 1000, 5000, 10000, 20000):
    ids = range(1, limit + 1)
    print(limit, 'bilingual before/after:',
          sum(all(x.get('translation') for x in before[str(i)]) for i in ids),
          sum(all(x.get('translation') for x in examples[str(i)]) for i in ids))
print('changed entries:', changed)
for i in (104, 2641, 4771, 10000, 15000):
    print('sample', i, WORDS[i-1]['word'], examples[str(i)])
if '--apply' in sys.argv:
    EXAMPLES.write_text(json.dumps(examples, ensure_ascii=False, separators=(',', ':')))
    print('applied')
else:
    Path('/tmp/english-bilingual-candidate.json').write_text(json.dumps(examples, ensure_ascii=False, separators=(',', ':')))
    print('candidate only; not applied')
