"""Convert attributed Tatoeba Chinese translations to simplified Chinese.

Requires OpenCC (`pip install opencc==1.1.9`). The source sentence and
translation link stay intact; adapted translations are marked in the data.
Run with --apply after checking the preview count.
"""

import json
import sys
from pathlib import Path

from opencc import OpenCC

path = Path(__file__).resolve().parents[1] / 'data/examples.json'
examples = json.loads(path.read_text(encoding='utf-8'))
converter = OpenCC('t2s')
changed = 0
for items in examples.values():
    for item in items:
        original = item.get('translation')
        if not original or not item.get('translationId'):
            continue
        simplified = converter.convert(original)
        if simplified != original:
            item['translation'] = simplified
            item['translationAdapted'] = 'OpenCC t2s'
            changed += 1

print(f'{changed} linked Chinese translations converted to simplified characters')
if '--apply' in sys.argv:
    path.write_text(json.dumps(examples, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
