"""Curate awkward, duplicated or misleading starter examples."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
words = json.loads((ROOT / "data/words.json").read_text())
examples = json.loads((ROOT / "data/examples.json").read_text())

# Two short, everyday sentences for words whose sourced examples were weak.
# Each sentence and translation here was written for this project.
replacements = {
    103: [("The bus is late.", "公交车晚点了。"), ("The keys are on the table.", "钥匙在桌上。")],
    116: [("Your phone is on the table.", "你的手机在桌上。"), ("I met her on the train.", "我在火车上遇见了她。")],
    122: [("I'd like to go, but I'm busy.", "我想去，但我现在有事。"), ("It's small but comfortable.", "它不大，但很舒适。")],
    126: [("I'm not ready yet.", "我还没准备好。"), ("That's not what I meant.", "我不是那个意思。")],
    128: [("I came by train.", "我是坐火车来的。"), ("Please send it by Friday.", "请在周五前发给我。")],
    135: [("Who is at the door?", "谁在门口？"), ("Do you know who called?", "你知道是谁打来的吗？")],
    144: [("I will call you tonight.", "我今晚给你打电话。"), ("Will you be there tomorrow?", "你明天会到吗？")],
    149: [("I think this is a good idea.", "我觉得这是个好主意。"), ("Let me think about it.", "让我想想。")],
    155: [("A lot of people are waiting outside.", "外面有很多人在等。"), ("How many people are coming?", "有多少人要来？")],
    157: [("Let's go out for lunch.", "我们出去吃午饭吧。"), ("The lights are out.", "灯灭了。")],
    163: [("I'm free now.", "我现在有空。"), ("What should we do now?", "我们现在该做什么？")],
    168: [("The dog is wagging its tail.", "那只狗正在摇尾巴。"), ("The company changed its name.", "那家公司改了名字。")],
    169: [("Our train leaves at eight.", "我们的火车八点出发。"), ("This is our table.", "这是我们的桌子。")],
    172: [("Which way is the station?", "去车站怎么走？"), ("I like the way you explain things.", "我喜欢你的讲解方式。")],
    178: [("What's that thing on the table?", "桌上那个东西是什么？"), ("The first thing is to stay calm.", "首先要保持冷静。")],
    181: [("You did really well.", "你做得很好。"), ("I'm not feeling well today.", "我今天不太舒服。")],
    199: [("The meeting is over.", "会议结束了。"), ("Come over this weekend.", "这个周末过来吧。")],
    201: [("Are you still at work?", "你还在上班吗？"), ("It's still raining.", "雨还在下。")],
    203: [("May I ask you a question?", "我能问你一个问题吗？"), ("Ask for help if you need it.", "需要的话就求助。")],
    204: [("Erm, let me check.", "嗯，让我查一下。"), ("Erm, what time is it?", "嗯，现在几点了？")],
    207: [("Which state do you live in?", "你住在哪个州？"), ("Please state your name.", "请说出你的名字。")],
    211: [("The price is too high.", "这个价格太高了。"), ("The shelf is too high for me.", "那个架子对我来说太高了。")],
    233: [("Where is the nearest station?", "最近的车站在哪儿？"), ("Where should we meet?", "我们在哪儿见面？")],
    235: [("We need to solve this problem.", "我们得解决这个问题。"), ("Is there a problem with the order?", "订单有什么问题吗？")],
    251: [("Turn right at the next street.", "下一条街右转。"), ("You're right about that.", "你说得对。")],
    266: [("Why did this happen?", "为什么会发生这件事？"), ("What will happen next?", "接下来会发生什么？")],
    270: [("About a million people live here.", "这里住着大约一百万人。"), ("The company sold a million tickets.", "这家公司卖出了一百万张票。")],
    274: [("Is there a quiet area to work?", "有安静的工作区吗？"), ("I live in this area.", "我住在这一带。")],
    275: [("The national team won.", "国家队赢了。"), ("Today is a national holiday.", "今天是全国性假日。")],
    279: [("I started this job last month.", "我上个月开始做这份工作。"), ("See you next month.", "下个月见。")],
    297: [("Can you provide more details?", "你能提供更多细节吗？"), ("The hotel will provide breakfast.", "酒店会提供早餐。")],
    303: [("The station is ten minutes away.", "车站离这里有十分钟路程。"), ("Please put your phone away.", "请把手机收起来。")],
    304: [("I'll be here until six.", "我会待到六点。"), ("Wait until the rain stops.", "等雨停了再走。")],
    307: [("Do you want to play a game?", "你想玩个游戏吗？"), ("What time does the game start?", "比赛几点开始？")],
    309: [("Have you eaten yet?", "你吃过了吗？"), ("The bus hasn't arrived yet.", "公交车还没到。")],
    311: [("I don't follow political news much.", "我不太关注政治新闻。"), ("They had a political discussion.", "他们讨论了政治话题。")],
    313: [("She was among the first to arrive.", "她是最先到的人之一。"), ("We found the keys among the papers.", "我们在那堆文件里找到了钥匙。")],
    318: [("It's raining; however, we can still go.", "下雨了，不过我们还是可以去。"), ("However tired you are, take a break.", "不管你有多累，都休息一下。")],
    324: [("We're almost there.", "我们快到了。"), ("It's almost time to leave.", "快到出发时间了。")],
    327: [("Let's set a time to meet.", "我们定个见面时间吧。"), ("Please set the table.", "请摆一下餐具。")],
    330: [("I'd like the white one.", "我想要白色的那个。"), ("The walls are white.", "墙是白色的。")],
    332: [("The president gave a speech.", "总统发表了讲话。"), ("She is the president of our club.", "她是我们俱乐部的会长。")],
    341: [("There's nothing in the bag.", "包里什么都没有。"), ("Nothing happened.", "什么事也没发生。")],
    343: [("Can you lead the meeting?", "你能主持会议吗？"), ("This road will lead us to the station.", "这条路能带我们到车站。")],
    349: [("Please follow me.", "请跟我来。"), ("Follow the instructions on the screen.", "请按屏幕上的说明操作。")],
    352: [("Please stop here.", "请在这里停一下。"), ("Which bus stop is closest?", "哪个公交站最近？")],
    357: [("This course is at a beginner level.", "这门课是入门级的。"), ("The water level is rising.", "水位正在上升。")],
    365: [("Are you sure about that?", "你确定吗？"), ("I'm sure we can find it.", "我相信我们能找到。")],
    368: [("Are you going to the party?", "你要去参加聚会吗？"), ("It's a small birthday party.", "这是个小型生日聚会。")],
    370: [("These plants grow quickly.", "这些植物长得很快。"), ("I want to grow my business.", "我想把生意做大。")],
    372: [("Let's walk to the station.", "我们走去车站吧。"), ("Do you want to go for a walk?", "你想去散步吗？")],
    378: [("The girl is reading a book.", "那个女孩正在看书。"), ("I met a girl from my class.", "我遇见了班上的一个女孩。")],
    379: [("That guy works with me.", "那个人和我一起工作。"), ("Who's the guy at the door?", "门口那个人是谁？")],
    381: [("He made it himself.", "这是他自己做的。"), ("He lives by himself.", "他一个人住。")],
    383: [("The air feels fresh today.", "今天空气很清新。"), ("Let's get some fresh air.", "我们出去透透气吧。")],
    384: [("My teacher explained it again.", "老师又讲解了一遍。"), ("Ask your teacher for help.", "向老师求助。")],
    390: [("Although it's late, I'm not tired.", "虽然很晚了，我还不累。"), ("I went out although it was raining.", "虽然下着雨，我还是出门了。")],
    397: [("Are you able to come tomorrow?", "你明天能来吗？"), ("I wasn't able to open the file.", "我没能打开这个文件。")],
    398: [("What's your age?", "你多大了？"), ("We're the same age.", "我们同岁。")],
    402: [("The application process is simple.", "申请流程很简单。"), ("We need to improve this process.", "我们得改进这个流程。")],
    405: [("The results will appear on the screen.", "结果会显示在屏幕上。"), ("She didn't appear at the meeting.", "她没有出席会议。")],
    411: [("Do you serve breakfast?", "你们供应早餐吗？"), ("This bus doesn't serve the airport.", "这趟公交车不到机场。")],
    413: [("The flowers will die without water.", "花没水会枯死。"), ("The battery is about to die.", "电池快没电了。")],
    421: [("Could you cut this in half?", "你能把这个切成两半吗？"), ("I need to cut my spending.", "我得减少开支。")],
    424: [("Her death shocked the family.", "她的离世让家人很震惊。"), ("The cause of death is unknown.", "死因尚不清楚。")],
    431: [("This delay will kill our schedule.", "这次延误会打乱我们的安排。"), ("Smoking can kill.", "吸烟可能致命。")],
    437: [("Can you control the volume?", "你能调一下音量吗？"), ("I lost control of the car.", "我的车失控了。")],
    445: [("My former boss moved abroad.", "我以前的老板去了国外。"), ("She's a former student of mine.", "她以前是我的学生。")],
    449: [("This job will require some travel.", "这份工作需要偶尔出差。"), ("Do you require any help?", "你需要帮忙吗？")],
    451: [("The app is still in development.", "这个应用还在开发中。"), ("The development of this area is changing fast.", "这一带的发展变化很快。")],
    455: [("The economic situation is improving.", "经济状况正在好转。"), ("We discussed the economic impact.", "我们讨论了经济影响。")],
    459: [("This coffee is too strong for me.", "这杯咖啡对我来说太浓了。"), ("The wind is strong today.", "今天风很大。")],
    467: [("Call the police if you need help.", "需要帮助就报警。"), ("The police are here.", "警察来了。")],
    474: [("What's the price of this ticket?", "这张票多少钱？"), ("The price has gone up.", "价格涨了。")],
    480: [("We need to develop a better plan.", "我们得制定一个更好的计划。"), ("I'm trying to develop a new habit.", "我在努力养成一个新习惯。")],
    481: [("The view from here is beautiful.", "这里的景色真美。"), ("I'd like to hear your view.", "我想听听你的看法。")],
    485: [("Can you drive me to the station?", "你能开车送我去车站吗？"), ("I don't like to drive at night.", "我不喜欢夜间开车。")],
    486: [("My arm is sore today.", "我的胳膊今天有点疼。"), ("He put his arm around her.", "他搂住了她。")],
    488: [("The federal government announced new rules.", "联邦政府公布了新规定。"), ("Federal law applies here.", "这里适用联邦法律。")],
    492: [("This course offers good value.", "这门课很划算。"), ("I value your opinion.", "我很看重你的意见。")],
    493: [("This is an international flight.", "这是一趟国际航班。"), ("Our team works with international clients.", "我们团队与国际客户合作。")],
    494: [("We need to take action now.", "我们现在得采取行动。"), ("What action should we take?", "我们该采取什么行动？")],
}

for word_id, pairs in replacements.items():
    word = words[word_id - 1]["word"]
    assert len(pairs) == 2
    assert all(re.search(r"\b" + re.escape(word) + r"\b", english, re.I) for english, _ in pairs), (word_id, word)
    examples[str(word_id)] = [
        {"text": english, "translation": chinese, "source": "original"}
        for english, chinese in pairs
    ]

assert all(len(examples[str(i)]) == 2 and all(x.get("translation") for x in examples[str(i)]) for i in range(1, 501))
(ROOT / "data/examples.json").write_text(json.dumps(examples, ensure_ascii=False, separators=(",", ":")))
print(f"Curated {len(replacements)} common-word entries.")
