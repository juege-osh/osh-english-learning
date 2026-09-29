"""Editorially reviewed, everyday examples for the first 100 words.
Run after build_examples.py and fill_example_gaps.py to preserve this hand-curated set.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'data' / 'examples.json'
WORDS = ROOT / 'data' / 'words.json'
# id | English sentence 1 | Chinese translation 1 | English sentence 2 | Chinese translation 2
ROWS = """11|Could I have some water?|可以给我一点水吗？|The water is too hot.|水太烫了。
12|Is the food ready?|饭做好了吗？|Let's get some food first.|我们先去吃点东西吧。
13|I'll have a coffee, please.|请给我一杯咖啡。|Do you want coffee or tea?|你想喝咖啡还是茶？
14|Would you like some tea?|你想喝点茶吗？|This tea smells lovely.|这茶闻起来真香。
15|Can you pass me the bread?|你能把面包递给我吗？|We need bread for breakfast.|早餐得有面包。
16|Would you like rice with that?|你想配点米饭吗？|The rice is almost ready.|米饭快好了。
17|I bought some fruit for us.|我给咱们买了些水果。|This fruit is really fresh.|这水果真新鲜。
18|Do we have any milk left?|我们还有牛奶吗？|I take my coffee without milk.|我喝咖啡不加牛奶。
19|Let's eat before it gets cold.|趁还没凉，咱们吃吧。|Did you eat already?|你吃过了吗？
20|What would you like to drink?|你想喝点什么？|I need a drink after that walk.|走了这么久，我想喝点东西。
21|I have to go now.|我现在得走了。|Shall we go together?|我们一起走吗？
22|Can you come a little earlier?|你能早点来吗？|Come in and have a seat.|进来坐吧。
23|I have a lot of work today.|我今天有很多工作。|What time do you finish work?|你几点下班？
24|Are you going home now?|你现在回家吗？|Make yourself at home.|别拘束，就像在自己家一样。
25|Is there room for one more?|还能再坐一个人吗？|Your room is on the second floor.|你的房间在二楼。
26|Could you close the door?|你能把门关上吗？|Someone is at the door.|有人在门口。
27|What time does the shop open?|这家店几点开门？|Please leave the window open.|请把窗户开着。
28|Please close the window.|请把窗户关上。|What time does the store close?|这家店几点关门？
29|Can you help me with this?|你能帮我弄一下吗？|Thanks for your help.|谢谢你的帮忙。
30|Do you need a hand?|你需要帮忙吗？|I need to leave by six.|我得在六点前离开。
31|What do you want to eat?|你想吃什么？|I want to try something new.|我想试点新东西。
32|I like this place.|我喜欢这个地方。|Would you like to join us?|你愿意和我们一起吗？
33|I can see the station from here.|我从这里能看到车站。|See you tomorrow!|明天见！
34|Look at this photo.|看看这张照片。|You look tired today.|你今天看起来有点累。
35|Did you read my message?|你看过我的消息了吗？|I like to read before bed.|我喜欢睡前看书。
36|Could you write that down?|你能把那个写下来吗？|I'll write to you when I arrive.|我到了以后会给你写信。
37|Do you speak English?|你会说英语吗？|Could I speak to the manager?|我能和经理说句话吗？
38|Please listen carefully.|请认真听。|I like to listen to music on the train.|我喜欢在火车上听音乐。
39|I want to learn English.|我想学英语。|You learn a lot by doing.|动手做能学到很多。
40|What does this word mean?|这个词是什么意思？|I can't remember the word.|我想不起那个词了。
41|I left my book on the table.|我把书落在桌上了。|Can I borrow your book?|我能借你的书吗？
42|My phone is almost dead.|我的手机快没电了。|Can I use your phone for a minute?|我能借你的手机用一下吗？
43|Can you show me on the map?|你能在地图上指给我看吗？|I saved the map on my phone.|我把地图保存在手机里了。
44|Is this the right road?|这条路走对了吗？|The road is closed ahead.|前面的路封了。
45|How long are you staying in the city?|你会在这座城市待多久？|This city is easy to get around.|这座城市出行很方便。
46|Which country are you from?|你来自哪个国家？|I'd love to visit your country.|我很想去你的国家看看。
47|I love to travel by train.|我喜欢坐火车旅行。|Is it safe to travel alone here?|在这里独自旅行安全吗？
48|Where can I buy a ticket?|我在哪儿可以买票？|Please keep your ticket with you.|请把票随身带好。
49|What time does the train leave?|火车几点出发？|We nearly missed the train.|我们差点没赶上火车。
50|Does this bus go downtown?|这辆公交车去市中心吗？|I usually take the bus to work.|我通常坐公交车上班。
51|What time is your flight?|你的航班几点？|My flight has been delayed.|我的航班延误了。
52|Is breakfast included at the hotel?|酒店含早餐吗？|Our hotel is close to the station.|我们的酒店离车站很近。
53|Let me check the time.|我看一下时间。|Please check your email.|请查收一下邮件。
54|This is my friend, Alex.|这是我的朋友亚历克斯。|A friend told me about this place.|一位朋友向我推荐了这个地方。
55|I'm happy to help.|我很乐意帮忙。|You look happy today.|你今天看起来很开心。
56|Is this your new phone?|这是你的新手机吗？|I started a new job this week.|我这周开始了一份新工作。
57|This is my old laptop.|这是我的旧笔记本电脑。|How old is your son?|你儿子多大了？
58|Could I have a small coffee?|可以给我一杯小杯咖啡吗？|It's a small problem.|这只是个小问题。
59|That's a big change.|那是个很大的变化。|I think the room is big enough.|我觉得这间房够大了。
60|How long will it take?|这要花多长时间？|It's been a long day.|今天真是漫长的一天。
61|Let's take a short break.|我们稍微休息一下吧。|Sorry, I only have a short time.|抱歉，我只有一点时间。
62|This app is easy to use.|这个应用用起来很方便。|That was easy, right?|那很简单，对吧？
63|This question is hard.|这道题很难。|Don't be too hard on yourself.|别对自己太苛刻。
64|What time does the meeting start?|会议几点开始？|Let's start with the easy part.|我们先从简单的部分开始。
65|I need to finish this today.|我今天得把这个做完。|What time will the movie finish?|电影几点结束？
66|Is this your first visit?|这是你第一次来吗？|You go first; I'll follow.|你先走，我跟着。
67|When did you last see her?|你上次见她是什么时候？|This is the last train tonight.|这是今晚最后一班火车。
68|Who's next in line?|排队的下一位是谁？|Let's meet next week.|我们下周见吧。
69|Are you free today?|你今天有空吗？|I learned a new word today.|我今天学了一个新词。
70|Can we talk tomorrow?|我们明天能聊吗？|I'm leaving tomorrow morning.|我明天早上出发。
71|Good morning! How did you sleep?|早上好！昨晚睡得怎么样？|I have a meeting in the morning.|我早上有个会。
72|Did you sleep well last night?|你昨晚睡得好吗？|Let's call it a night.|今天就到这儿吧。
73|Just one more minute, please.|请再给我一分钟。|I only need one ticket.|我只需要一张票。
74|Could I have two coffees?|请给我两杯咖啡好吗？|It takes about two hours.|大概需要两个小时。
75|I'll be there in three minutes.|我三分钟后到。|We need three more chairs.|我们还需要三把椅子。
76|The meeting starts at four.|会议四点开始。|There are four of us.|我们一共四个人。
77|I'll call you at five.|我五点给你打电话。|It costs five dollars.|这个要五美元。
78|The shop closes at six.|这家店六点关门。|I need six tickets, please.|请给我六张票。
79|We leave at seven tomorrow.|我们明天七点出发。|There are seven days in a week.|一周有七天。
80|I'll be ready by eight.|我八点前会准备好。|The train leaves at eight.|火车八点出发。
81|I have a call at nine.|我九点有个电话会议。|We open at nine tomorrow.|我们明天九点开门。
82|Give me ten minutes.|给我十分钟。|The bus comes every ten minutes.|这辆公交车每十分钟一班。
83|My computer is running slowly.|我的电脑运行得很慢。|Can I use your computer for a minute?|我能借你的电脑用一下吗？
84|Please send me the code.|请把代码发给我。|I can't find the error in this code.|我找不到这段代码里的错误。
85|Could you share the file with me?|你能把文件分享给我吗？|I saved the file on my desktop.|我把文件保存在桌面上了。
86|Don't forget to save your work.|别忘了保存你的工作成果。|Can we save this for later?|这件事我们能留到以后再说吗？
87|I found an error in the report.|我在报告里发现一个错误。|What does this error mean?|这个报错是什么意思？
88|Can you fix this before lunch?|你能在午饭前修好这个吗？|I'll fix it and send you a new version.|我修好后发你一个新版本。
89|Let's test it on another device.|我们换台设备测试一下吧。|Did you test the new link?|你测试过新链接了吗？
90|How long will it take to build?|建造这个需要多久？|We can build a simple version first.|我们可以先做一个简单版本。
91|I run every morning.|我每天早上跑步。|Can you run this program again?|你能再运行一次这个程序吗？
92|Can I use this chair?|我能用这把椅子吗？|It's easy to use.|这个用起来很方便。
93|Let's make dinner together.|我们一起做晚饭吧。|Does that make sense?|这样说得通吗？
94|Can you create a new folder?|你能建一个新文件夹吗？|Let's create a plan together.|我们一起定个计划吧。
95|The image looks blurry.|这张图片看起来有点模糊。|Can you send me the original image?|你能把原图发给我吗？
96|Did you watch the video I sent?|你看了我发的视频吗？|Let's make a short video.|我们拍个短视频吧。
97|I heard a strange sound.|我听到一个奇怪的声音。|Could you turn down the sound?|你能把声音调小点吗？
98|Please turn on the light.|请把灯打开。|This bag is really light.|这个包真的很轻。
99|What color do you prefer?|你更喜欢什么颜色？|I love the color of this shirt.|我喜欢这件衬衫的颜色。
100|Tell me the whole story.|把整件事告诉我吧。|That's a funny story.|这故事真有趣。"""

words = json.loads(WORDS.read_text())
examples = json.loads(PATH.read_text())
for line in ROWS.splitlines():
    number, en1, zh1, en2, zh2 = line.split('|')
    word_id = int(number)
    word = words[word_id - 1]['word']
    for sentence in (en1, en2):
        if not re.search(r'\b' + re.escape(word) + r'\b', sentence, re.IGNORECASE):
            raise ValueError(f'{word_id} {word}: target missing from {sentence}')
    examples[number] = [
        {'text': en1, 'translation': zh1, 'source': 'original'},
        {'text': en2, 'translation': zh2, 'source': 'original'},
    ]
PATH.write_text(json.dumps(examples, ensure_ascii=False, separators=(',', ':')))
print(f'Curated {len(ROWS.splitlines())} words × 2 bilingual examples')
