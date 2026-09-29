"""Add Simple Wiktionary usage examples, then clearly marked dialogue fallbacks."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
words = json.loads((root / 'data/words.json').read_text())
path = root / 'data/examples.json'
examples = json.loads(path.read_text())
need = {w['word']: str(w['id']) for w in words if len(examples.get(str(w['id']), [])) < 2}

with open('/tmp/english-quest-simplewiktionary.jsonl', encoding='utf8') as source:
    for line in source:
        entry = json.loads(line)
        word = entry.get('word', '').lower()
        if word not in need:
            continue
        current = examples.setdefault(need[word], [])
        for sense in entry.get('senses', []):
            for sample in sense.get('examples', []):
                sentence = re.sub(r'\s+', ' ', sample.get('text', '')).strip()
                if not 12 <= len(sentence) <= 180 or any(x['text'] == sentence for x in current):
                    continue
                current.append({'text': sentence, 'source': 'wiktionary', 'word': entry['word']})
                if len(current) >= 2:
                    break
            if len(current) >= 2:
                break
        if len(current) >= 2:
            del need[word]

fallback_count = 0
for w in words:
    current = examples.setdefault(str(w['id']), [])
    if len(current) >= 2:
        continue
    fallback = [
        {'text': f'I came across the word "{w["word"]}" today.', 'translation': f'我今天看到“{w["word"]}”这个词。', 'source': 'dialogue'},
        {'text': f'What does "{w["word"]}" mean here?', 'translation': f'这里的“{w["word"]}”是什么意思？', 'source': 'dialogue'},
    ]
    for item in fallback:
        if len(current) == 2:
            break
        current.append(item)
        fallback_count += 1

assert len(examples) == 20000 and all(len(v) == 2 for v in examples.values())
path.write_text(json.dumps(examples, ensure_ascii=False, separators=(',', ':')))
print(f'20,000 words / 40,000 sentences; {fallback_count} explicitly marked learning-dialogue fallbacks')
