"""Select short, attributed Tatoeba sentences for the local 10k word list."""
import bz2
import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
words = json.loads((ROOT / 'data/words.json').read_text())
targets = {w['word'] for w in words}
matches = collections.defaultdict(list)
token = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")

with bz2.open('/tmp/english-quest-tatoeba-eng.tsv.bz2', 'rt', encoding='utf8') as source:
    for line in source:
        fields = line.rstrip('\n').split('\t')
        if len(fields) < 4:
            continue
        sid, _lang, sentence, author = fields[:4]
        if not sentence.endswith(('.', '!', '?')) or len(sentence) > 105 or len(sentence) < 15:
            continue
        tokens = token.findall(sentence)
        if not 4 <= len(tokens) <= 16 or any(len(t) > 20 for t in tokens):
            continue
        lower = [t.lower() for t in tokens]
        for word in set(lower) & targets:
            if lower.count(word) != 1:
                continue
            # Short, ordinary examples are easier to read aloud and remember.
            score = (len(tokens), len(sentence), int(sid))
            items = matches[word]
            items.append((score, sid, sentence, author))
            if len(items) > 100:
                items.sort()
                del items[60:]

examples = {}
for w in words:
    candidates = sorted(matches[w['word']])
    chosen = []
    for _, sid, sentence, author in candidates:
        if sentence in {x['text'] for x in chosen}:
            continue
        chosen.append({'id': int(sid), 'text': sentence, 'author': author})
        if len(chosen) == 2:
            break
    if chosen:
        examples[str(w['id'])] = chosen

# Rare headwords need a wider sentence window. Keep the normal short set above.
missing = {w['word']: str(w['id']) for w in words if len(examples.get(str(w['id']), [])) < 2}
with bz2.open('/tmp/english-quest-tatoeba-eng.tsv.bz2', 'rt', encoding='utf8') as source:
    for line in source:
        fields = line.rstrip('\n').split('\t')
        if len(fields) < 4:
            continue
        sid, _lang, sentence, author = fields[:4]
        if not sentence.endswith(('.', '!', '?')) or not 12 <= len(sentence) <= 230:
            continue
        tokens = token.findall(sentence)
        if not 3 <= len(tokens) <= 32:
            continue
        lower = [t.lower() for t in tokens]
        for word in set(lower) & missing.keys():
            if lower.count(word) != 1:
                continue
            items = examples.setdefault(missing[word], [])
            if any(x['text'] == sentence for x in items):
                continue
            items.append({'id': int(sid), 'text': sentence, 'author': author})
            if len(items) >= 2:
                del missing[word]
        if not missing:
            break

out = ROOT / 'data/examples.json'
out.write_text(json.dumps(examples, ensure_ascii=False, separators=(',', ':')))
print(f'{len(examples)} words have examples; {sum(len(v) == 2 for v in examples.values())} have two; {out.stat().st_size} bytes')
print('Uncovered:', ', '.join(sorted(missing)))
