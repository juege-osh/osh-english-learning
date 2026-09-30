# 测试与构建辅助脚本

此目录包含前端逻辑测试及词库例句构建辅助脚本。

`curate_starter_examples.py` 是前 100 词双语句子的人工编辑层。重新构建整份例句数据时，在补全和简体转换后，依次运行它、`curate_first500_examples.py`、`curate_common_examples.py`、`curate_next200_examples.py --apply`，以及第 701–1100 词四批对应的 `curate_*_example_gaps.py --apply`。前 1,100 词就会恢复为每词两句双语例句；后 600 词的可编辑原稿存于 `data/curated_examples_*.tsv`。不要颠倒顺序。

`augment_bilingual_examples.py` 使用已下载的 Tatoeba 英中句子和关联表，从短句候选中优先选择有译文的例句。先不带参数运行并抽查结果；确认后加 `--apply`。完成语料补全及简体转换后，再执行上述人工编辑脚本。

`find_linked_bilingual_examples.py` 会扩大搜索范围，把漏掉的英中关联句写到 `/tmp` 供编辑筛选。试跑发现，候选里有词义不符、译错和不适合学习网站的句子，因此脚本刻意不提供直接写入词库的开关。逐句选定后，再放入人工编辑的 TSV。

`curate_701_800_example_gaps.py --apply` 为第 701–800 词补写 54 个词的 108 句：其中 33 个词原先缺中文，另 21 个词的原句重复、别扭或误译。可编辑原稿在 `data/curated_examples_701_800_gaps.tsv` 与 `data/curated_examples_701_800_fixes.tsv`。其余 46 个词保留原有双语语料，后续仍需继续审读。重建例句词库时，在语料补全和繁简转换之后运行。

`curate_801_900_example_gaps.py --apply` 为第 801–900 词补写 67 个词的 134 句：其中 43 个词原先缺中文，另 24 个词的原句重复、别扭或误译。剩下 33 个词暂沿用双语语料，后续继续审读。可编辑原稿分别在两份 `curated_examples_801_900_*.tsv`。重建例句词库时，紧接上一批脚本运行。

`curate_901_1000_example_gaps.py --apply` 为第 901–1000 词补写 50 个词的 100 句：其中 36 个词原先缺中文，另 14 个词的原句重复、误译或不适合入门练习。剩下 50 个词暂沿用双语语料，后续继续审读。可编辑原稿分别在两份 `curated_examples_901_1000_*.tsv`。

`curate_1001_1100_example_gaps.py --apply` 为第 1001–1100 词补写 62 个词的 124 句：其中 40 个词原先缺中文，另 22 个词的原句重复、误译或不适合入门练习。剩下 38 个词暂沿用双语语料，后续继续审读。可编辑原稿分别在两份 `curated_examples_1001_1100_*.tsv`。

完成语料补全后，可安装 `opencc==1.1.9`，运行 `normalize_translations.py` 预览繁转简数量，再用 `--apply` 写回。[OpenCC](https://github.com/BYVoid/OpenCC) 采用 Apache-2.0 许可；这里只在构建时使用，没有把其程序或词典打包进网站。已转换的句子带 `translationAdapted` 标记，页面显示“简体转换”并保留原译文链接。

`curate_first500_glosses.py` 在 `build_vocab.py` 后运行，为第 101–500 词补上简短常用中文义；接着运行 `curate_next200_glosses.py --apply`、`curate_next100_glosses.py --apply` 和第 801–1100 词三批 `curate_next100_glosses_*` 脚本，处理第 501–1100 词。这些编辑层都保留 ECDICT 原释义供展开查看。重建 `data/words.json` 后必须重跑。

第 1101–1200 词的简短中文义由 `curate_next100_glosses_1101_1200.py --apply` 写回，原稿在 `data/curated_glosses_1101_1200.tsv`。紧接第 1001–1100 词编辑层运行；这一批尚未补齐两句双语例句。

`codes_test.go` 覆盖站长生成、登录兑换、月卡30天/年卡365天/永久权益、重启及重复使用拒绝。`community_test.go` 覆盖主页保存、入群信息的权限隔离、过期权益和不安全链接拒绝。`scripts/qa_smoke.py` 现有47项隔离多账号检查；不可对正式站运行。

`programmer_reviewed.tsv` 是新增583个程序员词的行业释义，结合原100个起步词形成683词完整精选池；`programmer_examples.tsv` 为原100个起步词提供200句原创双语开发用语。重建时运行 `python3 build_industries.py`，缺词头、重复词头、缺译文、句子不含目标词都会拒绝写入。词条ID沿用主线，行业排序变化不会改主线关卡。

`industry-practice.test.js` 覆盖动态数量、句子选词、行业例句朗读文本、独立进度、专项错词复习及删除词过滤。`progress-sync.test.js` 检查不同设备按最近专项答案合并；同一时间的冲突保留错误，避免丢失待复习词。Go检查覆盖行业释义与选项、十条编辑路线的精选词进入榜单、新旧题库成绩隔离和旧题提交拒绝。

`ai_creator_reviewed.tsv`新增731个AI创作词，结合起步词形成831词；`healthcare_reviewed.tsv`新增653个医疗健康词，合成753词。两份对应的`*_examples.tsv`各有100词的200句双语用法。重建仍使用`build_industries.py`，不自动添加无关词凑数。医学释义面向英语学习，对话以问诊沟通为主。

`industry_confusables.json`按路线保存近义词组，构建时解析成有效词ID；句子选词排除这些组及相同中文义，英中选义不受影响。前端检查覆盖全部2222个有例句的行业词、四个互异选项、专项错词徽标和跨路线进度。

`biology_reviewed.tsv`与原起步词合成967词，替换了生物试练池。`biology_examples.tsv`为222词提供444句原创双语实验室、野外沟通用语。术语参考NHGRI遗传学词汇表，中文释义由本站编写。

`data/industry_words.json`单独收录1407个主线缺少的专业词，ID从20001开始，只追加，不能重编号或复用旧ID。主线words.json始终20,000词；首100个行业词顺序及考试词池沿用原内容。构建脚本按行业编辑表增加缺词，二次构建的输出字节相同。行业查询同时识别主线词和补充词，通用词量榜与单排/双排仍只使用主线词库。

新增检查覆盖补充词在专项题与榜单中出现、主线词量榜排除它们、服务重启后读取账号专项记录、跨设备最新答案合并、搜索大小写与中文、指定词句子练习及错词徽标。静态文件检查也确认补充词库已打包；页面不依赖启动时联网取词。主线词库、例句和场景文件与本轮之前逐字节相同。


`foreign_trade_reviewed.tsv`与原起步词合成774词，`finance_reviewed.tsv`合成846词；两条路线分别替换原试练池。各自的`*_examples.tsv`为前100词提供200句原创双语沟通用法，共400句。已剔除拼接写法、重复词形及偏题词，补充财务多义词的行业含义。贸易术语参考ICC，金融术语参考SEC Investor.gov。

`industry_display.json`只控制专项页面、专项榜出题和朗读的缩写展示，不改变canonical headword或词条ID。搜索不区分大小写，例句填空按显示词匹配；榜单内容版本包含展示字段。`TestIndustryAcronymsPreserveCanonicalProgressIDs`检查展示、原词、排行榜及版本；浏览器走通IPO的查词、句子选词、两句反馈和播放按钮。已有245个补充词的ID保持不变，新加386条；主线及考试池逐项核对没有变化。


`marketing_reviewed.tsv`、`law_reviewed.tsv`和`chemistry_reviewed.tsv`分别提供767、850、932词的本站编辑行业释义；各自`*_examples.tsv`提供前100词的200句原创双语交流用法，替换了原自动试练池。已有631条补充词保持原内容与编号，新词只追加。v1.25.0的九条路线共922个词配1844句，句子检查覆盖整份例句池。法律条目说明特定法域用语，化学条目区分吸附/吸收、精密度/准确度、氧化/还原。

专项路线选择存于浏览器独立偏好键，不写入主线或账号学习进度。前端测试覆盖有效路线刷新恢复、无效旧路线忽略、浏览器存储不可用时继续练习；短缩写完全匹配优先，pH不会被其他含ph的词淹没。`qa_smoke.py`新增三条路线的20题完整答对、题库释义数量和独立榜单检查。


## v1.26.0：速通与旅行专项

`data/grammar.json`保存36个知识点，各有一条短规则、一句双语用法、一道四选一和一道输入填空，共72题。填空给出结构或原形提示，答案表收录合理缩写与等价表达。题句和中文讲解由本站编写，语法辨析参考British Council LearnEnglish官方资料。

`data/phonics.json`保存44个音标的口型提示、88个示例词及参考音频路径；`audio/phonics/`里的44条ogg文件随程序嵌入。开放许可、作者、原文件和裁剪或时长调整见`provenance/phonics-audio.md`。素材来自不同示范，部分长音采用IPA基础音、部分辅音带辅助元音，卡片逐项说明；音频可播放不代表已经通过专业发音听审。

`qa/basics.test.js`检查两次独立听音成功、选择题与输入填空各一次、缩写及弯引号、空答案、错题补练、音频播放成功后才解锁选项、播放失败与取消、复练本轮计数、保存格式及主线进度独立。`progress-sync.test.js`还检查课程互补槽位合并；账号进度接口检查合法课程结构、重复槽位拒绝和跨设备保存。课程不写入主线`words`或增加XP。

`travel_reviewed.tsv`和`travel_examples.tsv`整理旅行709词及400词的800句原创双语用法。它和其余九条行业合计4722个句子目标词、9444句；行业含义已有本站编辑层，余下3390个行业词尚需补句子。十条行业加七条考试，共17条路线；补充行业词库现有1407词，原有ID保持，新增只追加。

专项答题反馈的释义和例句默认收起，用户展开后才看和听。手机导航显示4个常用入口，其他9个入口折叠到「更多」。

永久榜改造前，本轮34项Go测试通过（3.472秒），并发检测41.730秒、vet、前端逻辑与语法检查及43项四账号检查通过。浏览器实测音标两次真实播放后通过；语法选择题正确、填空故意答错后补练输入ARE通过并刷新保存；旅行句子题反馈折叠、展开和两句播放；390像素宽无横向溢出，底部导航高74像素。这些实测不代表整份录音获得专业听审或全部20,000词完成语言审校。

本轮最终回归、资源采样和私有仓库核验记录见根目录《交付状态.md》及《验收手册.md》。

排行榜本轮改为永久榜：同一账号可反复做20题挑战，保留答对数最高、同分用时最少的成绩，显示上榜北京时间。主线三种词量与各条专项分别排名，题库内容版本仍隔离。相关检查可运行 `node qa/leaderboard-ui.test.js` 和 Go 永久榜测试；最终结果见《交付状态.md》。

永久榜同一题库版本使用固定20题；最佳成绩的`submittedAt`为Unix毫秒，页面转为北京时间。全部旧每日榜记录保留在原始日期档案，并迁移为独立历史档案，不与新榜成绩比较，只有旧日期时不虚构精确上榜时间。

`practice-mode.test.js` 检查手动继续、正确立即跳题、1～30秒延迟解释、错误停留、重复操作防护、计时取消与独立偏好保存。

本轮永久榜后端最终42项Go测试4.428秒、并发检测53.935秒、vet及47项四账号检查通过；此前34/43项记录是改造前基线。


当前行业例句覆盖：程序员、外贸、AI创作、医疗、旅行各400词配800句；营销、法律各700词配1400句；金融、化学各300词配600句；生物722词配1444句。十行业合计4722词、9444句，仍3390词待补两句。
## v1.26.1 行业用法补齐

程序员、AI创作、医疗健康、旅行本次各增加100词的两句双语用法，共新增800句。四条路线现各覆盖200词、400句；十行业合计1422词、2844句，仍有6690词待补行业例句。此前版本中的前100词覆盖量是历史记录。主线词库、主线例句、场景与考试池保持不变，不增加主线进度。旅行的checked补充“托运的”，医疗的cranial补充“颅部的”，避免句子与释义不符。

程序员新增并发、内存、网络与开发用语；AI新增视觉制作、授权、模型训练及评估；医疗新增专科、登记、病史与病情描述沟通，不提供诊断或用药方案；旅行新增预算、预订、证件、机场与客舱沟通。可在专项页搜词，点「练这个词」，答后展开两句并分别播放；这四条路线的句子入口现显示200词。

本批验证：42项Go测试通过，vet通过；核心数据和专项前端检查覆盖全部1422个句子目标词，47项隔离四账号检查通过。真实浏览器分别走通waitlist、anatomy、header、alignment的句子选择和两句反馈，主线计数保持0，无控制台错误。仅增加行业用法与两条行业释义，未改答题布局或联机实现，因此未重复上一版本的并发与小屏布局检查。证据在 /tmp/english-quest-v1261-evidence/。

## v1.26.2 行业用法补齐

外贸、金融、市场营销、化学与材料各新增100词、200句双语用法，共800句。现在程序员、外贸、金融、AI创作、营销、医疗、化学、旅行八条路线各200词配400句；生物122词配244句，法律100词配200句。十行业合计1822词、3644句，仍有6290词待补。主线20,000词仍未逐条语言编辑，不能把题库结构检查当成内容审校完成。

新增例句覆盖询盘与报价、财务与审计、品牌与设计、实验室沟通。化学的efflorescence补充盐溶液干燥析晶含义；专业词不是都适合日常闲聊，句子以真实工作沟通为主。原有例句、全部行业学习编号、主线和考试池保持不变。

42项Go测试（最终4.740秒）、vet、核心数据和1822个句子目标词的前端检查通过；47项隔离四账号检查通过。实际浏览器走通inquiry、accounting、positioning和corrosivity的句子题及两句反馈，预览主线0保持；正式站positioning可答，站长主线15词保持，无控制台错误。本次没有改变布局和联机实现，不重复上一版本的并发与小屏检查。

2026-09-30 22:05:56（Asia/Ho_Chi_Minh）已部署正式站，真实支付保持关闭。生产二进制SHA256：31d4dcc8292eaf4d4a49b00ac80af7db7d3bf16e9698c9303f25e338c8e71c8f；旧二进制与状态备份：/opt/english-quest/releases/20260930-v1262/。证据：/tmp/english-quest-v1262-evidence/。

低负载采样：生产CPU1.3%、RSS40.3MiB、二进制23,294,175字节、状态20KiB、部署目录含历史约419.5MiB；本机含Git约660.3MiB。这是刚重启后的快照，不代表并发容量。

本批专业词参考：IUPAC Gold Book的[deliquescence](https://goldbook.iupac.org/terms/view/D01582)与[efflorescence](https://www.old.goldbook.iupac.org/html/E/E01909.html)，BIPM VIM的[precision](https://jcgm.bipm.org/vim/en/2.15.html)与[reproducibility conditions](https://jcgm.bipm.org/vim/en/2.24.html)；金融审计意见参考[PCAOB AS3105](https://pcaobus.org/oversight/standards/auditing-standards/details/AS3105)。句子为本站原创，参考用于核对概念，未复制原文。

## v1.26.3 行业用法与同步体验

程序员、旅行、生物和法律各新增100词的两句双语用法，共800句。十行业现有2222词配4444句，仍5890词待补；主线20,000词未逐条语言编辑。原有例句、行业学习编号、1407条补充专业词、主线及考试池均保持不变。旅行mask补充眼罩含义，并排除direct/nonstop等容易导致多解的干扰项。

修复初次云端同步、保存冲突与另一标签同步导致当前专项题、答后解释或未提交输入被重绘的问题。进度仍合并和保存，顶部信息正常更新；正在作答或有输入草稿时保留当前界面，空闲页面照常刷新。

42项Go测试4.500秒、vet、7套前端检查、47项隔离四账号检查通过。同步检查包含26个异步初次/冲突情境与实际跨标签处理。真实预览走通laboratory、advocate、cookie、nonstop的句子选择及两句反馈；正式站nonstop已实际答对，主线15词保持，无控制台错误。没有布局和联机改动，未重复此前并发与390像素布局验收。

2026-09-30 22:52:00（Asia/Ho_Chi_Minh）上线。生产PID3866586；二进制SHA256 c7262000d7b73251052ae5b9368680e540f98ec021a1b0fb54dd253dac1d5259；旧程序与状态备份/opt/english-quest/releases/20260930-v1263/。正式站行业数据已与本机逐字节核对，真实支付关闭。证据/tmp/english-quest-v1263-evidence/。

重启后低负载快照：生产CPU2.4%、RSS41.3MiB、运行文件23,412,911字节、状态20KiB、部署目录含历史441.8MiB；本机含Git673MiB。这不是并发容量。

本批术语核对参考：US Courts词汇表 https://www.uscourts.gov/glossary ；IUPAC Gold Book荧光与发光条目 https://goldbook.iupac.org/terms/view/F02453 、https://goldbook.iupac.org/terms/view/L03641 。例句为本站编写，未复制原文。

本批金融术语参考（仅核对词义，不复制正文或提供税务建议）：[IFRS IAS 36](https://www.ifrs.org/issued-standards/list-of-standards/ias-36-impairment-of-assets/) 和 [IRS Tax withholding](https://www.irs.gov/individuals/employees/tax-withholding)。减值、可收回金额和代扣税的例句为本站原创沟通用语。

本批医疗词语参考 [MedlinePlus](https://medlineplus.gov/appendixa.html)；外贸术语参考 [WCO](https://www.wcoomd.org/en/topics/nomenclature.aspx)、[UNCTAD](https://unctad.org/topic/trade-agreements/generalized-system-of-preferences)、[OSHA SDS说明](https://www.osha.gov/sites/default/files/publications/OSHA3694.pdf)和[HCCH Apostille资料](https://www.hcch.net/en/instruments/conventions/specialised-sections/apostille)。customhouse按[Cambridge](https://dictionary.cambridge.org/dictionary/english/custom-house)的建筑含义调整中文。例句均为本站原创。

## v1.26.4 大批行业用法补齐

外贸、AI创作、医疗各新增200词400句；金融新增100词200句，共新增700词1400句。十行业目前2922词配5844句，仍5190词待补两句行业用法。customhouse的中文调整为海关大楼、海关办事处；对应例句讲的是建筑位置和入口。主线、考试池、1407条补充专业词、全部学习编号和此前例句保持不变。新增行业句子继续排除可能多解的同义词、英美拼写和重叠岗位名称，不将这些词的专业概念视为等同。

42项Go测试4.338秒、vet、核心数据和全部2922个句子目标词检查通过，47项隔离四账号检查通过。真实预览走通distillation、abdominal、customhouse、impairment的句子选词与双语反馈，金融播放按钮可用，主线0保持，无控制台错误。仅改内容，未重复此前并发、小屏布局和联机全流程浏览器验收。

本批源代码、数据和说明同步私有仓库，整仓字节核验后发布；正式站实际版本以 /api/health 为准。发布回执、运行文件哈希、回滚备份与资源采样记录在 /tmp/english-quest-v1264-evidence/verification.json。真实支付仍关闭，不把模拟支付结果当作实际扣款。

## v1.26.5 生物、法律、营销与化学用法

四条路线各新增100词、200句双语工作或学习用法，共400词800句。生物覆盖营养元素、细胞代谢与遗传；法律覆盖签署执行、代理、费用与合同救济沟通；营销覆盖创作审批、制作物料、续费和重新激活；化学覆盖危害描述、标签库存与材料配方交流，不提供危险实验操作步骤。十行业现3322词配6644句，仍4790词待补两句，主线20,000词仍未逐条语言审校。已有词号、旧例句、主线和考试池均保持不变。句子干扰排除只用于避免多解，不表示专业概念等同。

42项Go测试4.533秒、vet、核心数据及全部3322个句子目标词检查、47项隔离四账号检查通过。实际预览走通flammable、magnesium、executory、storyboard的句子题和两句反馈；营销播放按钮已点击，主线0保持，无控制台错误。本次为内容变更，没有重复并发与小屏布局验收。

源代码、数据及说明整批同步私有仓库，整仓字节核验后发布；正式站当前版本以 /api/health 为准。发布哈希、回滚备份、实际线上核验与资源快照见 /tmp/english-quest-v1265-evidence/verification.json。真实支付宝仍关闭。

本批术语核验参考：[OSHA安全数据表栏目](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200AppD)、[NHGRI遗传词汇表](https://www.genome.gov/genetics-glossary)、[MedlinePlus外显率与表现度](https://medlineplus.gov/genetics/understanding/inheritance/penetranceexpressivity/)、[美国法院破产词汇表](https://www.uscourts.gov/court-programs/bankruptcy/bankruptcy-basics/bankruptcy-glossary)、[Shopify升级销售说明](https://www.shopify.com/blog/what-is-upselling)。例句为本站编写，法规内容不作为学习者的通用行动建议。


## v1.26.6 生物、法律、营销与旅行用法

生物、法律、营销各新增200词400句，旅行新增100词200句，共700词1400句常见双语用法。生物涵盖遗传、演化及生态观察；法律涵盖责任、授权、继承、担保与租赁沟通；营销涵盖客户挽回、调研、定价、渠道及背书；旅行涵盖租车、交通、船运、餐饮及饮食需求。十行业现4022词配8044句，仍4090词待补两句；主线20,000词尚未逐条语言编辑。

已有词号、行业释义、旧例句、主线与考试池保持不变。句子干扰排除用于避免同一句存在多个合理答案，不表示专业概念相同。新版完成测试、私有仓库整仓核验后发布；实际版本见 /api/health，发布哈希、回滚备份、浏览器验收和资源快照见 /tmp/english-quest-v1266-evidence/verification.json。真实支付宝仍未试付。

本批术语核对参考：[NHGRI遗传词汇表](https://www.genome.gov/genetics-glossary)、[OpenStax演化](https://openstax.org/books/biology-2e/pages/18-1-understanding-evolution)、[群落生态学](https://openstax.org/books/biology-2e/pages/45-6-community-ecology)、[纽约法院术语表](https://www.nycourts.gov/courts/7th-judicial-district/glossary)、[美国法院破产术语表](https://www.uscourts.gov/court-programs/bankruptcy/bankruptcy-basics/bankruptcy-basics-glossary)、[NIST统计](https://www.itl.nist.gov/div898/handbook/ppc/section1/ppc136.htm)、[OpenStax定价策略](https://openstax.org/books/principles-marketing/pages/12-4-pricing-strategies-for-new-products)、[FTC背书说明](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)、[TfL票价](https://tfl.gov.uk/fares/pay-the-right-fare?intcmp=79668)。旅行支付、驾照和保险表达采用询问句，不把地区规则写成全球规定。

42项Go测试4.426秒、vet、核心数据及全部4022个行业句子目标检查、47项隔离四账号检查通过。预览实际走通reactivate、mutagen、intentional、hire的句子题、释义折叠与两句反馈，营销播放按钮实际点击；主线0保持，无控制台错误。本次只有内容变化，没有重复并发与小屏布局验收。


## v1.26.7 生物、法律、营销与开发用法

生物、法律、营销各新增200词400句，程序员新增100词200句，共700词1400句双语工作或学习用法。生物涵盖生态与生理过程；法律涵盖土地、合同期限、披露和证据沟通；营销涵盖社群、搜索、广告指标和媒体交流；程序员涵盖异常处理、监控、数据库、分布式服务与协作开发。十行业现4722词配9444句，仍3390词待补两句；主线20,000词尚未逐条语言编辑。

已有词号、行业释义、旧例句、主线及考试池保持不变。句子干扰排除只为避免同一句多个合理答案，不表示专业概念相同。源代码、数据和说明整批同步私有仓库，整仓字节核验后发布；实际版本见 /api/health，发布哈希、回滚备份、浏览器验收及资源快照见 /tmp/english-quest-v1267-evidence/verification.json。真实支付宝仍未试付。

本批专业措辞核对参考：[Go panic/recover](https://go.dev/blog/defer-panic-and-recover)、[PostgreSQL约束](https://www.postgresql.org/docs/18/ddl-constraints.html)、[魁北克民法典](https://www.legisquebec.gouv.qc.ca/en/document/cs/CCQ-1991)、[英国土地登记指南](https://www.gov.uk/government/publications/easements-claimed-by-prescription-pg52)、[缅因州法院术语](https://www.med.uscourts.gov/glossary)、[Google Ads指标](https://support.google.com/google-ads/answer/9451527?hl=en)、[HubSpot线索阶段](https://knowledge.hubspot.com/records/use-lifecycle-stages)、[Google规范网址](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)。旧版主从命名在开发例句中明确标为传统用语，不改变学习词号。

42项Go测试4.542秒、vet、核心数据及4722个行业句子目标检查、47项隔离四账号检查通过。实际预览走通upstream、decomposer、restriction、review的句子选词、折叠展开与两句反馈，开发例句播放按钮实际点击；主线0保持，无控制台错误。专项前端检查原来固定写300词，已改为核对实际题库数量后通过；没有产品功能失败。本次仅改内容，未重复并发及小屏布局验收。

生物术语另核对[OpenStax氧需求](https://openstax.org/books/microbiology/pages/9-2-oxygen-requirements-for-microbial-growth)、[先天免疫](https://openstax.org/books/biology-2e/pages/42-1-innate-immune-response)、[行为生物学](https://openstax.org/books/biology-2e/pages/45-7-behavioral-biology-proximate-and-ultimate-causes-of-behavior)及[植物组织](https://openstax.org/books/biology-2e/pages/30-1-the-plant-body)。
