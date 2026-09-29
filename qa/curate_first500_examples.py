"""Replace weak first-500 examples with short, original bilingual sentences."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORDS = json.loads((ROOT / "data/words.json").read_text())
EXAMPLES = json.loads((ROOT / "data/examples.json").read_text())

# These headwords had no Chinese translation in either example.
PAIRS = {
    133: [("Their flight is delayed.", "他们的航班延误了。"), ("I met their family yesterday.", "我昨天见到了他们的家人。")],
    240: [("I can do my part.", "我会尽自己的一份力。"), ("Which part is confusing?", "哪一部分让你困惑？")],
    249: [("The system is down right now.", "系统现在出故障了。"), ("Please restart the system.", "请重启系统。")],
    252: [("I joined a training program.", "我参加了一个培训项目。"), ("Can you open the program?", "你能打开这个程序吗？")],
    257: [("The government announced new rules.", "政府宣布了新规定。"), ("I work for the government.", "我在政府部门工作。")],
    263: [("I believe you.", "我相信你。"), ("Do you believe this story?", "你相信这个故事吗？")],
    278: [("That's a fact.", "这是事实。"), ("Can you confirm that fact?", "你能核实那个事实吗？")],
    292: [("Do you have this in black?", "这个有黑色的吗？"), ("I take my coffee black.", "我喝不加奶和糖的咖啡。")],
    302: [("Can I sit here?", "我可以坐这里吗？"), ("Please sit down.", "请坐。")],
    312: [("When does the meeting end?", "会议什么时候结束？"), ("Let's end the call here.", "我们就聊到这儿吧。")],
    322: [("Nice to meet you.", "很高兴认识你。"), ("Can we meet tomorrow?", "我们明天能见面吗？")],
    326: [("Please continue.", "请继续。"), ("Can we continue tomorrow?", "我们明天能接着谈吗？")],
    339: [("Listen to your body.", "留意身体发出的信号。"), ("My body needs rest.", "我的身体需要休息。")],
    340: [("Could you send me the information?", "能把资料发给我吗？"), ("I need more information.", "我需要更多信息。")],
    350: [("Where is the city centre?", "市中心在哪儿？"), ("Let's meet at the shopping centre.", "我们在购物中心见吧。")],
    351: [("Are you a parent?", "你是家长吗？"), ("A parent needs to sign this form.", "这张表需要一位家长签字。")],
    377: [("I need to do some research.", "我得做点调查。"), ("The research looks promising.", "这项研究看起来很有希望。")],
    404: [("Please consider my proposal.", "请考虑我的提议。"), ("I'll consider it.", "我会考虑的。")],
    406: [("I actually agree with you.", "其实我同意你的看法。"), ("What actually happened?", "到底发生了什么？")],
    408: [("I'll probably be late.", "我可能会迟到。"), ("It'll probably rain later.", "待会儿可能会下雨。")],
    442: [("What field do you work in?", "你从事哪个领域？"), ("She's an expert in this field.", "她是这个领域的专家。")],
    452: [("They made it themselves.", "这是他们自己做的。"), ("They should decide for themselves.", "他们应该自己决定。")],
    454: [("What is your role on the team?", "你在团队里负责什么？"), ("She played a key role.", "她发挥了关键作用。")],
    458: [("What's the exchange rate?", "汇率是多少？"), ("What is the daily rate?", "每天的费用是多少？")],
    462: [("Take this drug with food.", "这种药要随餐服用。"), ("This drug may cause drowsiness.", "这种药可能会让人犯困。")],
    464: [("I can hear your voice clearly.", "我能清楚地听到你的声音。"), ("I've lost my voice.", "我嗓子哑了。")],
    482: [("We have a good working relationship.", "我们有良好的工作关系。"), ("Are you in a relationship?", "你在谈恋爱吗？")],
    496: [("This model is out of stock.", "这款型号缺货了。"), ("The new model is faster.", "新款型号速度更快。")],
    500: [("Does the price include tax?", "这个价格含税吗？"), ("I need to pay tax.", "我需要缴税。")],
}

# These headwords already had one translated example. Replace only the untranslated one.
SECOND = {
    126: ("I'm not ready yet.", "我还没准备好。"),
    150: ("When does the train leave?", "火车什么时候开？"),
    159: ("I just got here.", "我刚到。"),
    174: ("I stayed home because it rained.", "因为下雨，我待在家里。"),
    176: ("I can't find my keys.", "我找不到钥匙。"),
    180: ("How many people are coming?", "有多少人会来？"),
    202: ("Let's try again.", "我们再试一次。"),
    214: ("Most people agreed.", "大多数人都同意了。"),
    223: ("Please keep the receipt.", "请保留收据。"),
    231: ("You seem tired.", "你看起来累了。"),
    232: ("Can we talk later?", "我们晚点能聊聊吗？"),
    242: ("This place is easy to find.", "这个地方很好找。"),
    245: ("I have a few questions.", "我有几个问题。"),
    250: ("Each person gets one ticket.", "每人一张票。"),
    251: ("Turn right at the next street.", "下一条街右转。"),
    260: ("Let's move to the next topic.", "我们进入下一个话题。"),
    265: ("Can you bring your laptop?", "你能带上笔记本电脑吗？"),
    266: ("What will happen next?", "接下来会发生什么？"),
    275: ("The national team won.", "国家队赢了。"),
    284: ("I got a new job.", "我找到一份新工作。"),
    288: ("Stay on this side of the road.", "留在马路这一边。"),
    289: ("That's very kind of you.", "你真好。"),
    290: ("Let's head home.", "我们回家吧。"),
    291: ("How far is the station?", "车站有多远？"),
    293: ("We both agree.", "我们都同意。"),
    296: ("I haven't seen her since Monday.", "我从周一就没见过她。"),
    299: ("Is there a café around here?", "这附近有咖啡馆吗？"),
    305: ("The power is out.", "停电了。"),
    306: ("I'll be there in an hour.", "我一小时后到。"),
    309: ("Has the package arrived yet?", "包裹到了吗？"),
    328: ("Our community is growing.", "我们的社区在壮大。"),
    338: ("The kid is asleep.", "孩子睡着了。"),
    342: ("I called you an hour ago.", "我一个小时前给你打了电话。"),
    343: ("Can you lead the meeting?", "你能主持会议吗？"),
    344: ("I'm not very social at parties.", "我在聚会上不太擅长社交。"),
    348: ("Let's work on this together.", "我们一起做这件事吧。"),
    349: ("Please follow me.", "请跟我来。"),
    354: ("Do you need anything else?", "你还需要别的东西吗？"),
    356: ("I've already sent the email.", "我已经发了邮件。"),
    362: ("Your health comes first.", "健康最重要。"),
    363: ("She's the right person for the job.", "她是这份工作的合适人选。"),
    365: ("Are you sure about that?", "你确定吗？"),
    385: ("Don't force yourself.", "别勉强自己。"),
    393: ("Give me a second.", "等我一下。"),
    395: ("Maybe we should wait.", "也许我们该等等。"),
    400: ("Is everything okay?", "一切都还好吗？"),
    413: ("These plants die without water.", "这些植物没水会枯死。"),
    415: ("What do you expect from me?", "你希望我怎么做？"),
    420: ("The nation watched the final.", "全国人民观看了决赛。"),
    426: ("Someone left a message for you.", "有人给你留了言。"),
    429: ("Can you reach the top shelf?", "你够得到最上面的架子吗？"),
    430: ("Ask a local for directions.", "找当地人问路。"),
    439: ("Take care of yourself.", "照顾好自己。"),
    443: ("What else do we need?", "我们还需要什么？"),
    444: ("Can you pass me the salt?", "你能把盐递给我吗？"),
    446: ("Can we sell it online?", "我们能在网上卖它吗？"),
    453: ("I'll send the report today.", "我今天把报告发给你。"),
    455: ("The economic outlook is improving.", "经济前景正在好转。"),
    457: ("We need to decide today.", "我们今天得做决定。"),
    461: ("My heart is racing.", "我的心跳得很快。"),
    463: ("She's a strong leader.", "她是一位出色的领导者。"),
    466: ("I spent the whole day outside.", "我一整天都在外面。"),
    468: ("Do you mind if I sit here?", "你介意我坐这里吗？"),
    469: ("I finally found my keys.", "我终于找到钥匙了。"),
    473: ("My brother joined the military.", "我哥哥参军了。"),
    475: ("I need less sugar.", "我想少放点糖。"),
    480: ("We need to develop a better plan.", "我们得制定一个更好的计划。"),
    481: ("The view from here is beautiful.", "这里的景色真美。"),
    488: ("The federal government made the announcement.", "联邦政府发布了公告。"),
    499: ("We live in a changing society.", "我们生活在不断变化的社会。"),
}

def original(text, translation):
    return {"text": text, "translation": translation, "source": "original"}

for word_id, pairs in PAIRS.items():
    expected = [original(*pair) for pair in pairs]
    if EXAMPLES[str(word_id)] != expected:
        assert len(pairs) == 2 and all(not x.get("translation") for x in EXAMPLES[str(word_id)])
        EXAMPLES[str(word_id)] = expected

for word_id, pair in SECOND.items():
    current = EXAMPLES[str(word_id)]
    missing = [i for i, sentence in enumerate(current) if not sentence.get("translation")]
    if missing:
        assert len(missing) == 1, (word_id, missing)
        current[missing[0]] = original(*pair)
    else:
        assert original(*pair) in current, word_id

for word_id in list(PAIRS) + list(SECOND):
    word = WORDS[word_id - 1]["word"]
    assert all(re.search(r"\b" + re.escape(word) + r"\b", x["text"], re.I) for x in EXAMPLES[str(word_id)] if x.get("source") == "original"), (word_id, word)

assert len(PAIRS) == 29 and len(SECOND) == 70
assert all(len(EXAMPLES[str(i)]) == 2 and all(x.get("translation") for x in EXAMPLES[str(i)]) for i in range(1, 501))
(ROOT / "data/examples.json").write_text(json.dumps(EXAMPLES, ensure_ascii=False, separators=(",", ":")))
print("First 500 headwords now have two bilingual examples each.")
