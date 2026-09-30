"""Build editorial routes, with labelled trial pools for unreviewed routes.

The first words are hand-selected seed lists from the original site. The
extension is a related-vocabulary pool and should not be called a syllabus.
"""
import json
import re
from pathlib import Path
from qa.industry_core import CORE, GLOSSES

root = Path(__file__).parent
words = json.loads((root / 'data/words.json').read_text())
prior = json.loads((root / 'data/industries.json').read_text())
main_ids = {item['word'].lower(): item['id'] for item in words}
# Supplement IDs are append-only. Keep the main 20,000 entries and every
# previous specialist ID unchanged when an editorial route is expanded.
extras_file = root / 'data/industry_words.json'
extras = json.loads(extras_file.read_text()) if extras_file.exists() else []
extra_ids = {item['word']: item['id'] for item in extras}
if len(extra_ids) != len(extras) or len({item['id'] for item in extras}) != len(extras):
    raise RuntimeError('duplicate specialist vocabulary')
if any(item['id'] <= 20000 or item['id'] > 30000 or item['word'] in main_ids
       or not re.fullmatch('[a-z]+', item['word']) or not item['zh'] for item in extras):
    raise RuntimeError('invalid specialist vocabulary')
next_id = max([20000] + [item['id'] for item in extras]) + 1
for glossary in sorted((root / 'qa').glob('*_reviewed.tsv')):
    if glossary.name.startswith('.'):
        continue
    for line in glossary.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        headword, meaning = line.split('\t')
        if not re.fullmatch('[a-z]+', headword) or not meaning:
            raise RuntimeError(f'invalid specialist word: {headword}')
        if headword not in main_ids and headword not in extra_ids:
            if next_id > 30000:
                raise RuntimeError('specialist vocabulary exceeds ID range')
            extras.append({'id': next_id, 'word': headword, 'zh': meaning})
            extra_ids[headword] = next_id
            next_id += 1
word_ids = {**main_ids, **extra_ids}
confusables = json.loads((root / 'qa/industry_confusables.json').read_text())

# A strong ECDICT subject label plus topical words in the displayed meaning or
# English definition places useful vocabulary ahead of incidental polysemy.
specs = [
 ('programmer','程序员','代码、数据、网络与软件开发','计',
  '算法 程序 软件 代码 数据 网络 系统 服务器 编译 文件 函数 变量 计算机 模型 数据库 用户 界面 加密',
  'algorithm software code data network server program compiler database function file computer interface encryption'),
 ('foreign_trade','外贸','询盘、合同、物流与跨境结算','经',
  '贸易 出口 进口 运输 航运 货物 关税 海关 订单 报价 发票 合同 付款 客户 供应 交付 仓库 物流',
  'trade export import shipment freight customs tariff order invoice contract payment supplier delivery warehouse logistics'),
 ('finance','金融','报表、投资、信贷与风险','经',
  '金融 银行 投资 证券 股票 债券 基金 贷款 利率 货币 汇率 资产 负债 资本 财务 风险 保险 会计',
  'finance bank investment stock bond fund loan interest currency exchange asset liability capital accounting risk insurance'),
 ('ai_creator','AI 创作','模型、图像、声音与内容制作','计',
  '人工智能 模型 生成 图像 视频 声音 音频 动画 镜头 剪辑 提示词 训练 神经网络 内容 创作 设计',
  'artificial intelligence model generate image video audio animation camera edit prompt training neural content design'),
 ('marketing','市场营销','品牌、消费者、推广与增长','经',
  '营销 广告 品牌 市场 消费者 客户 销售 推广 产品 定价 增长 渠道 受众 宣传 竞品 需求',
  'marketing advertisement brand market consumer customer sales promotion product pricing growth audience publicity demand'),
 ('healthcare','医疗健康','就诊、症状、护理与保险','医',
  '医院 医生 患者 病人 症状 疾病 治疗 手术 药物 药品 诊断 护理 健康 疫苗 感染 医疗',
  'hospital doctor patient symptom disease treatment surgery medicine diagnosis nursing health vaccine infection medical'),
 ('biology','生物科学','细胞、遗传、生态与实验','医',
  '生物 细胞 基因 遗传 蛋白 细菌 病毒 进化 生态 物种 植物 动物 酶 组织 器官 微生物',
  'biology cell gene genetic protein bacteria virus evolution ecology species plant animal enzyme tissue organism'),
 ('law','法律','合同、诉讼、权利与合规','法',
  '法律 法院 律师 诉讼 合同 权利 责任 证据 违法 犯罪 判决 法规 条款 起诉 仲裁 合规',
  'law court lawyer litigation contract right liability evidence crime judgment regulation clause prosecution arbitration compliance'),
 ('chemistry','化学与材料','元素、反应、材料与工艺','化',
  '化学 元素 分子 原子 反应 酸 碱 溶液 材料 聚合物 金属 晶体 温度 试剂 浓度',
  'chemistry element molecule atom reaction acid alkaline solution material polymer metal crystal reagent concentration'),
]

def relevance(item, tag, zh_terms, en_terms):
    zh = item['zh']
    full = item['full']
    en = item['en'].lower()
    word = item['word'].lower()
    score = 0
    if f'[{tag}]' in full:
        score += 4
    score += sum(8 for term in zh_terms if term in zh)
    score += sum(3 for term in en_terms if re.search(r'\b'+re.escape(term)+r'\b', en) or word == term)
    return score

output = []
for id_, name, description, tag, zh_words, en_words in specs:
    zh_terms, en_terms = zh_words.split(), en_words.split()
    priority = list(dict.fromkeys(main_ids[w.lower()] for w in CORE[id_].split() if w.lower() in main_ids))
    initial = priority[:100]
    if len(initial) != 100:
        raise RuntimeError(f'{id_} needs 100 reviewed starting words, found {len(initial)}')
    glosses = {str(word_id): GLOSSES[id_][words[word_id - 1]['word']] for word_id in initial}
    glosses.update({str(word_id): GLOSSES[id_][words[word_id - 1]['word']]
                    for word_id in priority[len(initial):]
                    if words[word_id - 1]['word'] in GLOSSES[id_]})
    # A reviewed TSV replaces the trial pool entirely. Never count a keyword
    # match as editorial review, or pad a professional route with common words.
    reviewed_file = root / 'qa' / f'{id_}_reviewed.tsv'
    example_file = root / 'qa' / f'{id_}_examples.tsv'
    route_examples = {}
    if reviewed_file.exists():
        reviewed = []
        seen_headwords = set()
        for line in reviewed_file.read_text().splitlines():
            if not line or line.startswith('#'):
                continue
            headword, meaning = line.split('\t')
            if headword in seen_headwords or headword not in word_ids or not meaning:
                raise RuntimeError(f'{id_}: invalid reviewed entry {headword}')
            seen_headwords.add(headword)
            word_id = word_ids[headword]
            reviewed.append(word_id)
            glosses[str(word_id)] = meaning
        initial = list(dict.fromkeys(initial + reviewed))
        if len(initial) < 500:
            raise RuntimeError(f'{id_}: reviewed route needs at least 500 words')
        # Only keep senses that actually belong to the resulting route.
        glosses = {str(word_id): glosses[str(word_id)] for word_id in initial}
        selected = []
    else:
        priority_set = set(priority)
        candidates = [(relevance(w, tag, zh_terms, en_terms),w) for w in words
                      if w['id'] not in priority_set and len(w['word']) >= 3
                      and w['word'].isalpha() and not w['zh'].startswith(('abbr.', 'pron.'))]
        selected = priority[len(initial):]
        selected += [w['id'] for score,w in sorted(candidates,key=lambda x:(-x[0],x[1]['rank'],x[1]['id'])) if score>=4][:max(0,700-len(priority))]
    if example_file.exists():
        for line in example_file.read_text().splitlines():
            if not line or line.startswith('#'):
                continue
            headword, en1, zh1, en2, zh2 = line.split('\t')
            word_id = word_ids[headword]
            if word_id not in initial or str(word_id) in route_examples:
                raise RuntimeError(f'{id_}: invalid example entry {headword}')
            items = []
            for text, translation in ((en1,zh1), (en2,zh2)):
                if not translation or not re.search(r'\b'+re.escape(headword)+r'\b', text, re.I):
                    raise RuntimeError(f'{id_}: example missing target word or translation: {headword}')
                items.append({'text':text,'translation':translation,'source':'original'})
            route_examples[str(word_id)] = items
    # Show the remaining hand-picked, topic-specific words before automated
    # dictionary matches. A broad sense such as "system" or "design" can
    # otherwise rank unrelated headwords ahead of useful industry vocabulary.
    if len(initial)+len(selected)<500:
        raise RuntimeError(f'{id_} only has {len(initial)+len(selected)} related entries')
    route = {'id':id_,'name':name,'description':description,'category':'industry','coreCount':len(initial),'glosses':glosses,'wordIds':initial+selected}
    if route_examples:
        route['examples'] = route_examples
    groups = []
    for headwords in confusables.get(id_, []):
        group = [word_ids[headword] for headword in headwords if headword in word_ids and word_ids[headword] in initial]
        if len(group) >= 2:
            groups.append(group)
    if groups:
        route['confusableGroups'] = groups
    output.append(route)
for x in prior:
    if x.get('category')=='exam':output.append(x)
extras_file.write_text(json.dumps(extras,ensure_ascii=False,separators=(',',':')))
(root/'data/industries.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')))
print([(x['id'],len(x['wordIds'])) for x in output])
