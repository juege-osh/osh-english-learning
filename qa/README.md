# 测试与构建辅助脚本

此目录包含前端逻辑测试及词库例句构建辅助脚本。

`curate_starter_examples.py` 是前 100 词双语句子的人工编辑层。重新构建整份例句数据时，在补全和简体转换后，依次运行它、`curate_first500_examples.py`、`curate_common_examples.py`、`curate_next200_examples.py --apply`，以及第 701–1100 词四批对应的 `curate_*_example_gaps.py --apply`。再依次运行 `curate_main_1101_1500.py --apply`、`curate_main_1501_1900.py --apply`、`curate_main_1901_2300.py --apply`、`curate_main_2301_2700.py --apply`、`curate_main_2701_3100.py --apply`、`curate_main_3101_3500.py --apply`、`curate_main_3501_3900.py --apply`、`curate_main_3901_4300.py --apply`、`curate_main_4301_4700.py --apply`、`curate_main_4701_5100.py --apply`、`curate_main_5101_5500.py --apply`、`curate_main_5501_5900.py --apply`、`curate_main_5901_6300.py --apply`、`curate_main_6301_6700.py --apply`、`curate_main_6701_7100.py --apply`、`curate_main_7101_7900.py --apply`、`curate_main_7901_8500.py --apply`、`curate_main_8501_9100.py --apply`、`curate_main_9101_9700.py --apply`、`curate_main_9701_10300.py --apply`、`curate_main_10301_10900.py --apply`、`curate_main_10901_11500.py --apply`、`curate_main_11501_12100.py --apply`、`curate_main_12101_12700.py --apply`、`curate_main_12701_13300.py --apply`、`curate_main_13301_13900.py --apply`、`curate_main_13901_14500.py --apply`、`curate_main_14501_15100.py --apply`、`curate_main_15101_15700.py --apply`、`curate_main_15701_16300.py --apply`、`curate_main_16301_16900.py --apply`、`curate_main_16901_17500.py --apply`、`curate_main_17501_18100.py --apply`、`curate_main_18101_18700.py --apply`，前 18,700 词会恢复为每词两句双语例句。第 501–18700 词的编辑原稿存于 `data/curated_examples_*.tsv`。不要颠倒顺序。

`augment_bilingual_examples.py` 使用已下载的 Tatoeba 英中句子和关联表，从短句候选中优先选择有译文的例句。先不带参数运行并抽查结果；确认后加 `--apply`。完成语料补全及简体转换后，再执行上述人工编辑脚本。

`find_linked_bilingual_examples.py` 会扩大搜索范围，把漏掉的英中关联句写到 `/tmp` 供编辑筛选。试跑发现，候选里有词义不符、译错和不适合学习网站的句子，因此脚本刻意不提供直接写入词库的开关。逐句选定后，再放入人工编辑的 TSV。

`curate_701_800_example_gaps.py --apply` 为第 701–800 词补写 54 个词的 108 句：其中 33 个词原先缺中文，另 21 个词的原句重复、别扭或误译。可编辑原稿在 `data/curated_examples_701_800_gaps.tsv` 与 `data/curated_examples_701_800_fixes.tsv`。其余 46 个词保留原有双语语料，后续仍需继续审读。重建例句词库时，在语料补全和繁简转换之后运行。

`curate_801_900_example_gaps.py --apply` 为第 801–900 词补写 67 个词的 134 句：其中 43 个词原先缺中文，另 24 个词的原句重复、别扭或误译。剩下 33 个词暂沿用双语语料，后续继续审读。可编辑原稿分别在两份 `curated_examples_801_900_*.tsv`。重建例句词库时，紧接上一批脚本运行。

`curate_901_1000_example_gaps.py --apply` 为第 901–1000 词补写 50 个词的 100 句：其中 36 个词原先缺中文，另 14 个词的原句重复、误译或不适合入门练习。剩下 50 个词暂沿用双语语料，后续继续审读。可编辑原稿分别在两份 `curated_examples_901_1000_*.tsv`。

`curate_1001_1100_example_gaps.py --apply` 为第 1001–1100 词补写 62 个词的 124 句：其中 40 个词原先缺中文，另 22 个词的原句重复、误译或不适合入门练习。剩下 38 个词暂沿用双语语料，后续继续审读。可编辑原稿分别在两份 `curated_examples_1001_1100_*.tsv`。

完成语料补全后，可安装 `opencc==1.1.9`，运行 `normalize_translations.py` 预览繁转简数量，再用 `--apply` 写回。[OpenCC](https://github.com/BYVoid/OpenCC) 采用 Apache-2.0 许可；这里只在构建时使用，没有把其程序或词典打包进网站。已转换的句子带 `translationAdapted` 标记，页面显示“简体转换”并保留原译文链接。

`curate_first500_glosses.py` 在 `build_vocab.py` 后运行，为第 101–500 词补上简短常用中文义；接着运行 `curate_next200_glosses.py --apply`、`curate_next100_glosses.py --apply` 和第 801–1100 词三批 `curate_next100_glosses_*` 脚本，处理第 501–1100 词。这些编辑层都保留 ECDICT 原释义供展开查看。重建 `data/words.json` 后必须重跑。

第 1101–1200 词的简短中文义由 `curate_next100_glosses_1101_1200.py --apply` 写回，原稿在 `data/curated_glosses_1101_1200.tsv`。紧接第 1001–1100 词编辑层运行；这一批的两句双语例句现由 `curate_main_1101_1500.py --apply` 恢复。

`codes_test.go` 覆盖站长生成、登录兑换、月卡30天/年卡365天/永久权益、重启及重复使用拒绝。`community_test.go` 覆盖主页保存、入群信息的权限隔离、过期权益和不安全链接拒绝。`scripts/qa_smoke.py` 现有47项隔离多账号检查；不可对正式站运行。

`programmer_reviewed.tsv` 是新增583个程序员词的行业释义，结合原100个起步词形成683词完整精选池；`programmer_examples.tsv` 为全表683词提供1366句原创双语开发用语。重建时运行 `python3 build_industries.py`，缺词头、重复词头、缺译文、句子不含目标词都会拒绝写入。词条ID沿用主线，行业排序变化不会改主线关卡。

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

`travel_reviewed.tsv`和`travel_examples.tsv`整理旅行709词及全词表的1418句原创双语用法。它和其余九条行业合计8112个句子目标条目、16224句；行业含义和两句用法均已覆盖全表。十条行业加七条考试，共17条路线；补充行业词库现有1407词，原有ID保持，新增只追加。

专项答题反馈的释义和例句默认收起，用户展开后才看和听。手机导航显示4个常用入口，其他9个入口折叠到「更多」。

永久榜改造前，本轮34项Go测试通过（3.472秒），并发检测41.730秒、vet、前端逻辑与语法检查及43项四账号检查通过。浏览器实测音标两次真实播放后通过；语法选择题正确、填空故意答错后补练输入ARE通过并刷新保存；旅行句子题反馈折叠、展开和两句播放；390像素宽无横向溢出，底部导航高74像素。这些实测不代表整份录音获得专业听审或全部20,000词完成语言审校。

本轮最终回归、资源采样和私有仓库核验记录见根目录《交付状态.md》及《验收手册.md》。

排行榜本轮改为永久榜：同一账号可反复做20题挑战，保留答对数最高、同分用时最少的成绩，显示上榜北京时间。主线三种词量与各条专项分别排名，题库内容版本仍隔离。相关检查可运行 `node qa/leaderboard-ui.test.js` 和 Go 永久榜测试；最终结果见《交付状态.md》。

永久榜同一题库版本使用固定20题；最佳成绩的`submittedAt`为Unix毫秒，页面转为北京时间。全部旧每日榜记录保留在原始日期档案，并迁移为独立历史档案，不与新榜成绩比较，只有旧日期时不虚构精确上榜时间。

`practice-mode.test.js` 检查手动继续、正确立即跳题、1～30秒延迟解释、错误停留、重复操作防护、计时取消与独立偏好保存。

本轮永久榜后端最终42项Go测试4.428秒、并发检测53.935秒、vet及47项四账号检查通过；此前34/43项记录是改造前基线。


当前十条行业路线共8112个学习条目，每个条目都有两句本站编写的双语行业用法，共16224句。程序员683、外贸774、金融846、AI创作831、营销767、医疗753、生物967、法律850、化学与材料932、旅行709，均已补齐。不同路线可能包含相同词，8112不是去重后的词汇数。主线20,000词的逐条语言编辑和44音标的专业听审仍待完成。
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


## v1.26.8 三条行业例句补齐与金融扩充

生物新增245词490句、法律150词300句、营销67词134句，三条路线已分别覆盖967、850、767词，每词两句双语。金融另补200词400句，现覆盖500词。合计新增662词1324句；十行业现5384词配10768句，仍2728词待补，主线20,000词尚未逐条语言编辑。

生物涵盖花部、植物生长、生态水文、分类与野外记录；法律涵盖司法公正、审查、解释与法律原则；营销涵盖广告证据、环保表达、公益和广告技术；金融涵盖监管、信托、风控、结算与财务沟通。专业句子用于工作或学习交流，不把不同法律程序、科学概念和财务指标教成等同。句子题会排除能在同一句中合理替换的干扰词；相反概念保持区分。旧例句字节前缀、全部学习编号、原有释义、1407补充专业词、主线及考试池保持。

在「行业与考试」选生物、法律、营销或金融，可点「句子选词」练习；也可展开「查找专项词」，搜 anthocyanin、prejudgment、substantiation 或 regulator，点击「练这个词」。答后点「查看释义与例句」，查看两句中文并逐句朗读。专项学习不增加主线词数。

42项Go测试4.614秒、vet、核心数据及全部5384个行业句子目标检查通过；47项隔离四账号检查通过。真实预览走通上述四词的句子题、折叠展开与双语反馈，营销播放按钮已点击；主线0保持，无控制台错误。本批仅改内容，没有重复并发和小屏布局验收。

源代码、数据和说明整批同步私有仓库，整仓字节核验后发布。正式站实际版本见 /api/health；发布哈希、回滚备份、线上验收与低负载资源快照见 /tmp/english-quest-v1268-evidence/verification.json。真实支付宝仍未试付，专业音标听审和完整主线语言审校仍待完成。

本批疑难概念来源核对，例句均自行编写：

- 花部与胚珠：[OpenStax 被子植物](https://openstax.org/books/biology/pages/26-3-angiosperms)；连锁基因仍可重组：[遗传连锁](https://openstax.org/books/biology-2e/pages/13-1-chromosomal-theory-and-genetic-linkage)；碱度与pH区分：[USGS 碱度](https://www.usgs.gov/water-science-school/science/alkalinity-and-water)。
- 令状术语：[美国第九巡回上诉法院](https://www.ca9.uscourts.gov/guides-resources/glossary/)；prejudgment预先判断：[英国法院原始判决](https://www.judiciary.uk/wp-content/uploads/2019/04/bates-judgment-no.4-9-april-19-final.pdf)；cassation特定程序：[法国官方说明](https://www.service-public.gouv.fr/particuliers/vosdroits/F2224?lang=en)。
- 环保宣传：[FTC Green Guides](https://www.ftc.gov/business-guidance/resources/environmental-claims-summary-green-guides)；增量与归因：[Google Ads 增量实验](https://support.google.com/google-ads/answer/12003020?hl=en)；广告技术角色：[IAB 2025术语附录](https://www.iab.com/wp-content/uploads/2025/06/IAB_Untangling_Issues_Commerce_Media_Networks_June_23_2025.pdf)。
- APR与利息率区分：[CFPB](https://www.consumerfinance.gov/ask-cfpb/what-is-the-difference-between-a-mortgage-interest-rate-and-an-apr-en-135/)；结算：[BIS](https://www.bis.org/committees/cpmi/pfmi/overview)；信托角色：[OCC术语表](https://www.occ.gov/static/ots/trust-handbook/ots-trust-handbook-glossary.pdf)。


## v1.26.9 程序员、医疗与旅行例句补齐

程序员补283词566句、医疗补353词706句、旅行补309词618句，共945词1890句。三条路线分别覆盖683、753、709词，每词两句原创双语；加上生物、法律、营销，六条路线的行业例句已覆盖全表。十行业合计6329词配12658句，仍1783词待补：外贸374、金融346、AI创作431、化学与材料632。主线20,000词的逐条语言编辑和音标专业听审尚未完成。

开发用法覆盖组件、数据结构、数值计算、网络、协作审查与发布；医疗用法围绕病史描述、预约、检查报告和康复沟通，不用例句替代诊断或用药；旅行涵盖饮食过敏、购物通信、景点、户外天气与求助。句子题排除同句可合理替换的干扰词，仍区分饮食要求、相反状态与不同专业概念。三个追加例句文件的旧字节前缀、全部学习编号、主线及考试池保持不变。

金融APR原中文较宽，本次改为「年百分率（APR，借款年化成本指标）」；对应补充词ID20306及一处旧例句译文同步修正，英文和学习编号保持。参考[CFPB对借款利息率与APR的说明](https://www.consumerfinance.gov/ask-cfpb/what-is-the-difference-between-a-mortgage-interest-rate-and-an-apr-en-135/)，不把所有产品的APR一概解释为包含全部费用。该内容编辑照常使用题库版本隔离。

在「行业与考试」选择程序员、医疗或旅行，进入「句子选词」；也可展开「查找专项词」，搜索component、chill、vegetarian后点「练这个词」。答后展开「查看释义与例句」，逐句看中文、点播放。金融搜APR可查看修正释义。专项练习不会增加主线词数。

本批源代码、数据和说明整批同步私有仓库，整仓字节核验后发布。实际版本见 /api/health；发布哈希、回滚备份、浏览器验收、测试与低负载资源快照见 /tmp/english-quest-v1269-evidence/verification.json。真实支付宝仍待配置和本人试付。

42项Go测试通过（最终5.627秒），vet、核心数据及全部6329个行业句子目标检查通过；47项隔离四账号检查通过。真实预览走通component、chill、vegetarian和APR的句子题、折叠展开与两句反馈，程序员播放按钮已点击，主线0保持且无控制台错误。本批只有内容变化，没有重跑并发和小屏布局验收。

本批疑难用法核对来源：

- 开发缓冲与定位：[Python io](https://docs.python.org/3/library/io.html)；刷新不等于持久化：[os.fsync](https://docs.python.org/3/library/os.html#os.fsync)；身份与权限：[OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)。
- 医疗用词：[MedlinePlus aspiration](https://medlineplus.gov/ency/article/002216.htm)、[CDC灭菌与消毒](https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/introduction-methods-definition-of-terms.html)。
- 旅行沟通：[FDA食品过敏](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies)、[Apple eSIM](https://support.apple.com/en-gb/118227)。这些页面用于核对含义；双语句子由本站编写。


## v1.27.0 术语核对来源

四条补齐路线的例句为本站编写。专业含义核对参考 [ICC贸易术语问答](https://library.iccwbo.org/clp/clp-incoterms-qa-2020.htm?AGENT=ICC_HQ)、[美国商务部贸易融资指南](https://www.trade.gov/report/trade-finance-guide)、[欧盟CE说明](https://single-market-economy.ec.europa.eu/single-market/goods/ce-marking_en)、[NAIC保险术语](https://content.naic.org/glossary-insurance-terms)、[SEC净资产值](https://www.investor.gov/introduction-investing/investing-basics/glossary/net-asset-value)、[OIC期权Greeks](https://prd-web.optionseducation.org/advancedconcepts/understanding-options-greeks)、[Adobe音频增益与压缩](https://helpx.adobe.com/audition/desktop/effects-reference/amplitude-compression-effects.html)和[W3C转写说明](https://www.w3.org/WAI/media/av/transcripts/)。不把FCL写成必须装满，不把CE写成欧盟产品批准，不把EBITDA当成银行现金，也不混淆流通股份与汇率浮动。句子干扰排除只限制选项，不表示金融指标、贸易角色或科学概念相同。


## v1.27.0 十条行业例句全表覆盖

外贸补374词748句、金融346词692句、AI创作431词862句、化学与材料632词1264句，共新增1783词3566句。十条行业路线的8112个学习条目现在各有两句本站编写的双语用法，共16224句；路线间可能重复，不当作8112个去重词。主线20,000词的逐条语言编辑、44音标的专业听审仍未完成。

在「行业与考试」选外贸、金融、AI创作或化学与材料，点「句子选词」练全表；也可展开「查找专项词」，搜surety、EBITDA、actress或biocompatibility，点「练这个词」。答后展开「查看释义与例句」，看中文并逐句播放。建议先理解双语用法，再切速刷；错词到复习营地回练。专项学习与主线词数分别保存。

原例句字节前缀、全部学习编号、主线及考试池保持。专业例句用于语言交流，金融指标、贸易角色和科学概念仍区分；干扰词排除只为减少同句多解。化学句子不写危险实验参数。真实支付宝仍待配置和本人试付。

本批测试、私有仓库整仓核验、线上实测、回滚备份及资源快照见 /tmp/english-quest-v1270-evidence/verification.json。只有内容改动，不把旧版并发与小屏布局检查当作本次重测。

化学用法另核对 [IUPAC吸着](https://goldbook.iupac.org/terms/view/S05769/plain)、[IUPAC分散度](https://goldbook.iupac.org/terms/view/12226/plain)、[OpenStax电解](https://openstax.org/books/chemistry-2e/pages/17-7-electrolysis)、[NIST单位量名](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-8)和[FDA生物相容性评估](https://www.fda.gov/medical-devices/biocompatibility-assessment-resource-center/basics-biocompatibility-information-needed-assessment-fda)。不混淆质量/重量、molarity/molality、eluent/eluate、silicon/silicone/silica；吸着是泛称，不能只等同表面吸附。

本批42项Go测试通过（最终11.968秒）、vet、核心数据及全部8112个行业句子目标检查通过；47项隔离四账号检查通过。实际预览走通surety、EBITDA、actress、biocompatibility，答后展开两句反馈，金融播放按钮已点击；主线0保持，无控制台错误。本次未重跑布局和并发检查。


## v1.27.1 主线常用义与双语用法推进到1500词

为第1101–1500词编写400词800句日常双语用法，为第1201–1500词整理300个简短常用中文义。现在主线前1500词都有两句双语用法和简短中文义；原词号、关卡顺序与完整词典定义保留，十行业词表和16224句行业例句保持原内容。遇到同词多义，用两句展示常见含义，例如bear的熊/忍受、novel的小说/新颖、ring的戒指/响铃。

少量原始词头是人名或语气词：Henry为人名，mhm为应答音，eg为e.g.的无点写法，释义已有提示。这些条目沿用既有编号，不将它们冒充新增实义词。完整20000词仍未逐条编辑，不能把前1500词的覆盖说成全词库语言审校完成。

在「我的词库」输入mental、advice、equipment或expand，点搜索，再展开「看两条例句」，可查看中文并逐句朗读；正常闯关也会使用新例句。建议先理解用法，再用速刷巩固，错词单独复习。

42项Go测试5.275秒、vet、主线前1500词双语目标与核心数据检查、全部8112行业句子目标检查通过。本次没有改布局与联机逻辑，未重复旧版并发和小屏布局检查。仓库与发布回执见/tmp/english-quest-v1271-evidence/verification.json。真实支付宝仍关闭。

重建主线数据时，在旧版1101–1200常用义脚本之后运行 `python3 qa/curate_main_1101_1500.py --apply`，恢复本批300个常用义和400词800句；先不加参数可预览校验。它保留词号和原词典定义，原稿分别在四个 `curated_examples_1101_1200` 至 `1401_1500` TSV及三个 `curated_glosses_1201_1300` 至 `1401_1500` TSV。

## v1.27.2 主线常用义与双语用法推进到1900词

本批为第1501–1900词整理400个简短常用中文义，并编写800句日常双语用法。主线前1900词现在每词都有常用义和两句双语；原词号、词头和关卡顺序保留。例句覆盖出行、生活、学习和工作沟通，也区分常见多义，例如resolution的决心/分辨率、mirror的镜子/反映、signal的手机信号/示意。

Tom、Tony、Leeds、Glasgow等人名地名，以及III、Corp.等数字或缩写，释义明确说明；原学习编号保留，不将它们算成新增实义词。gay使用现代常用含义。完整20000词尚未逐条完成语言编辑，前1900词的双语覆盖不代表全库审校完成。

实际验收发现，词库原有五分钟缓存可能让刚刷新的页面继续显示旧释义。本批让题库JSON随刷新校验内容版本，未变化的文件仍通过ETag复用缓存；同时更新主线加载地址，避免沿用旧缓存。无需清掉学习记录或重新登录。十行业的8112个路线条目及16224句行业用法保持原内容。

可在「我的词库」搜索capture、mirror、resolution或signal，展开「看两条例句」，查看中文并逐句播放；正常闯关使用同一批内容。建议先理解句子，再用速刷巩固。实际测试、仓库字节核对、上线回执和资源采样见/tmp/english-quest-v1272-evidence/verification.json。真实支付宝仍关闭，主线内容继续补齐。

恢复第1501–1900词编辑层时，在前一批脚本后运行 `python3 qa/curate_main_1501_1900.py --apply`。四份例句TSV各100行、每词两句；四份常用义TSV各100行。先不带--apply可仅校验。

## v1.27.3 主线推进到2300词

第1901–2300词新增400个常用中文义和800句日常双语用法。前2300词每词都有简明常用义及两句双语，完整20000词仍在逐条编辑。十行业8112个路线条目的16224句行业用法保持原内容；路线间可能有重复，不是8112个去重词。

本批区分mine的“我的/矿井”、crop的“收成/裁剪”、draft的“草稿/穿堂风”等常用义；teen改用青少年含义，Ben、Lewis、Lee、Taylor按姓名解释，Sept、Oct、Nov标明月份缩写。学习编号、关卡顺序、范围外词条及原词典完整定义保留。英文和中文逐句审读，格式检查不替代语言审校。

可以在「我的词库」搜索mine、deficit、crop或teen，展开「看两条例句」查看翻译并播放。主线刷题使用相同内容；已有缓存修复保留，正常刷新可取得新词库，不需要清学习进度。

42项Go测试通过（4.923秒），vet、主线前2300词双语目标及8112行业句子目标检查通过；47项隔离四账号检查通过。实际预览走通上述四词的双语展开，teen例句播放按钮已点击，未见控制台错误。只改语言内容，未重复并发或小屏布局检查。私有仓库核验、发布结果和资源采样记录在/tmp/english-quest-v1273-evidence/verification.json。真实支付仍关闭，音标专业逐条听审尚未完成。


## v1.27.4 主线推进到2700词

第2301–2700词新增400个常用中文义和800句自然双语用法，前2700词均有简明中文义与两句双语。完整20000词的逐条编辑仍在进行。原学习编号、关卡顺序和完整词典定义保留，范围外词条及十行业内容保持。

本批区分remote的偏远/遥控器、counter的柜台/反驳、uniform的制服/一致等常见用法；mall按购物中心解释，psychologist按心理学家解释。Ken、Ruth为姓名，Feb为月份缩写，qv为书面参见缩写；Hong、Kong、Zealand等原有地名组成部分明确说明，不冒充独立新增实义词。

在「我的词库」搜索remote、counter、roger或mall，展开「看两条例句」查看翻译并播放；主线刷题使用同一批内容。建议先理解两句的具体含义，再切速刷巩固。

42项Go测试通过（最终5.085秒）、vet、前2700词核心检查、8112行业句子目标检查和app.js语法检查通过；47项隔离四账号检查通过。真实预览走通上述四词双语展开并点击mall例句播放，无控制台错误。仅内容改动，未重复并发或小屏布局验收。仓库核对、发布回执和资源采样见/tmp/english-quest-v1274-evidence/verification.json。真实支付仍关闭，44音标专业逐条听审待完成。

## v1.27.5 主线推进到3100词

第2701–3100词新增400个常用中文义和800句自然双语用法，前3100词均有简明中文义与两句双语。完整20000词仍未逐条编辑。保留原学习编号、词头顺序和完整词典定义，范围外词条及十行业内容不变。

jet区分喷气式飞机与喷射流，moderate区分适度与主持讨论，correlation明确相关性不能证明因果关系，developer使用开发沟通常见句子。人名、地名和缩写按实际用途注明；粗俗口语标注用语性质。

新增八份TSV及qa/curate_main_2701_3100.py，可重建本批数据。42项Go测试通过（5.186秒）、vet、前3100词核心检查、8112行业句子目标检查和app.js语法检查通过；47项隔离四账号检查通过。预览实际展开jet、moderate、correlation、developer双语并点击developer例句播放，无控制台错误。本批仅内容改动，未重复并发及小屏布局检查。仓库核验、生产回执及资源采样见/tmp/english-quest-v1275-evidence/verification.json。真实支付仍关闭，44音标专业逐条听审待完成。

## v1.27.6 主线推进到3500词

第3101–3500词新增400个常用中文义和800句双语日常用法。主线前3500词均有常用义与两句双语，完整20000词仍在逐条编辑。保留学习编号、词头顺序和完整词典定义，范围外词条及行业场景数据不变。

database用图书馆和查找记录的场景，resume区分继续与简历，equity区分公平与股权，seal区分封口与海豹。Benjamin按人名解释，不沿用旧的安息香释义；Eric、Ross、Jenny等姓名及IRA缩写注明用途。可在我的词库搜词、展开两句并播放，主线刷题使用同一批内容。

42项Go测试6.090秒、vet、前3500词核心检查、8112行业句子目标及app.js语法检查通过；47项隔离四账号检查通过。实际预览展开database、resume、equity、seal双语并点击seal播放，无控制台错误。本批没有布局和联机规则变化，未重复并发或小屏布局检查。私有仓库核验、上线回执、回滚备份与资源采样见/tmp/english-quest-v1276-evidence/verification.json。真实支付仍关闭，44音标专业逐条听审尚未完成。

## v1.27.7 主线推进到3900词

第3501–3900词新增400个简明常用义和800句双语用法。前3900词都有常用中文义与两句双语；完整20000词尚未逐条语言编辑。学习编号、词头顺序与完整原词典定义保留，范围外词条和行业场景内容不变。

bug区分虫子和程序错误，touchdown区分美式橄榄球达阵和飞机着陆，franchise区分特许经营与系列作品，artifact区分人工遗物和扫描伪影。姓名、地名、缩写、单位与粗俗口语均注明性质；例句以日常沟通为主，避免套用统一模板。

42项Go测试通过（5.414秒）、vet、前3900词核心检查、8112行业句子目标与app.js语法检查通过；47项隔离四账号检查通过。真实预览展开上述四词双语并点击bug例句播放，无控制台错误。本批仅内容改动，未重复并发及小屏布局验收。私有仓库核验、生产回执与资源快照见/tmp/english-quest-v1277-evidence/verification.json。真实支付仍关闭，44音标专业逐条听审待完成。

## v1.27.8 主线推进到4300词

第3901–4300词新增400个常用中文义和800句双语日常用法。前4300词均有常用义与两句双语，完整20000词仍未逐条语言编辑。原学习编号、词头顺序和完整词典定义保留，范围外词条及行业场景内容不变。

spare区分备用与抽出时间，chemistry区分化学与人际默契，marble区分大理石与弹珠，manual区分手册与手动。ICI明确为历史企业缩写，姓名地名、Tel和ft等缩写注明用途，粗俗口语标注强度，不当作正式沟通建议。

42项Go测试通过（5.118秒）、vet、前4300词核心检查、8112行业句子目标与app.js语法检查通过；47项隔离四账号检查通过。真实预览展开spare、chemistry、marble、manual的两句双语，并点击spare例句播放，未见控制台错误。仓库字节核验与发布回执见/tmp/english-quest-v1278-evidence/verification.json。只改语言内容，未重复并发与小屏布局验收。真实支付仍关闭，44音标专业逐条听审待完成。

## v1.27.9 主线推进到4700词

第4301–4700词新增400个常用中文义和800句双语日常用法。前4700词均有常用义与两句双语，完整20000词仍未逐条语言编辑。保留学习编号、词头顺序和完整原词典定义，范围外词条和行业场景内容不变。

clutch区分离合器与手拿包，trillion采用现代常用的万亿，orthodox区分传统做法与东正教，rotate区分旋转与轮换。Du、Turner等姓名、英国地名，以及Los Angeles和El Paso里的地名组成部分明确注明；这些既有条目不当作新增实义词。例句逐词编写和审读，不用统一模板凑数。

42项Go测试通过（初次5.463秒，最终缓存）、vet、前4700词核心检查、8112行业句子目标和app.js语法检查通过；47项隔离四账号检查通过。真实预览展开clutch、trillion、orthodox、rotate两句双语并点击rotate例句播放，无控制台错误。本批仅内容改动，没有重复并发或小屏布局验收。私有仓库字节核验、生产回执和资源采样见/tmp/english-quest-v1279-evidence/verification.json。真实支付仍关闭，44音标专业逐条听审待完成。


## v1.28.0 主线推进到5100词

第4701–5100词新增400个常用中文义和800句日常双语用法，前5100词均覆盖。完整20000词仍未逐条语言编辑。保留学习编号、词头顺序和完整原词典定义，范围外词条及行业场景内容不变。

umbrella区分雨伞和统领框架，bark区分犬吠和树皮，conductor区分乐队指挥和导体，navy区分海军和深蓝色。姓名地名、ANC/bp/lb缩写、franco外来贸易用语、ruine罕见化学名均注明性质；不把原有罕见条目冒充常见口语。

42项Go测试5.301秒、vet、前5100词核心检查、8112行业句子目标及app.js语法检查通过；47项隔离四账号检查通过。真实预览展开vocabulary、umbrella、bark和conductor两句双语并点击conductor播放，无控制台错误。本批只改语言内容，未重复并发或小屏布局。私有仓库核验、发布结果及资源采样见/tmp/english-quest-v1280-evidence/verification.json。真实支付仍关闭，44音标专业逐条听审尚未完成。

本批罕见词复核来源：franco运费用语见[法兰西学院词典](https://dictionnaire-academie.fr/article/A9F1549)及[Cambridge法英词典](https://dictionary.cambridge.org/us/dictionary/french-english/franco)；ruine收录情况见[Pharmacognosy Reviews植物化合物综述表](https://phcogrev.com/sites/default/files/PhcogRev-7-14-199.pdf)。仅说明原词库中罕见名称的性质，不提供化学操作或治疗指导。


## v1.28.1 主线推进到5500词

第5101–5500词新增400个常用中文义和800句日常双语，前5500词均覆盖。完整20000词仍未逐条语言编辑。保留学习编号、词头顺序和完整原词典定义，范围外词条与行业场景不变。

recorder区分录音机和竖笛，server区分服务员与服务器；download修正为下载，不沿用旧词典的“卸载、下栽”。elk注明美式加拿大马鹿与英式驼鹿用法。姓名、VI/vi、DOS、oz、LJ、ORD及问卷术语subscale注明性质，粗俗用语标明强度。每词两句逐句审读，避免模板凑数。

42项Go测试6.535秒、vet、前5500词核心检查、8112行业句子目标及app.js语法检查通过；47项隔离四账号检查通过。真实预览展开recorder、offset、server、download双语并点击download播放，无控制台错误。仅内容改动，未重复并发与小屏布局。私有仓库核验、生产回执与资源采样见/tmp/english-quest-v1281-evidence/verification.json。真实支付仍关闭，44音标专业听审未完成。

本批术语核对来源：[American Heritage elk英美区别](https://ahdictionary.com/word/search.html?q=Elk)、[NPS加拿大马鹿](https://www.nps.gov/romo/learn/nature/elk.htm)、[美国法院起诉说明](https://www.uscourts.gov/glossary-legal-terms/indictment)、[英国司法人员称谓](https://www.judiciary.uk/guidance-and-resources/what-do-i-call-a-judge/)、[奥黑尔机场ORD](https://www.flychicago.com/ohare/pages/default.aspx)、[APA分量表例子](https://www.apa.org/pubs/books/supplemental/Making-Evidence-Based-Psychological-Treatments-Work-Older-Adults/Appendix2.1.pdf)。这些来源仅供核对词义，不是医疗或法律行动建议。

本批 ROS 机器人软件用法参考官方介绍：https://index.ros.org/r/ros/ 。缩写也保留原只读存储器释义，例句明确上下文。


## v1.28.2 主线推进到5900词

第5501–5900词新增400个常用中文义和800句自然双语，前5900词均覆盖。完整20000词仍未逐条语言编辑。保留学习编号、词头顺序及完整原词典定义，范围外对象和行业场景内容不变。

receipt用于收据沟通，replicate用于复现，commute与commuter区分通勤行为和通勤者；ROS补机器人软件框架用法，并保留只读存储器上下文。royalty区分王室和版税；姓名、地名、缩写、calory罕见拼写与destine较少使用的形式均注明性质，不把罕见词当日常口语。

42项Go测试最终5.252秒、vet、前5900词核心及8112行业句子目标检查、app.js语法检查通过；47项隔离四账号检查通过。真实预览展开receipt、replicate、ROS、commute的两句双语并点击例句播放，无控制台错误。仅内容变化，未重复并发与小屏布局。仓库核验、发布及资源回执见/tmp/english-quest-v1282-evidence/verification.json。真实支付仍关闭，44音标专业听审未完成。


## v1.28.4 主线推进到6300词

第5901–6300词新增400个简短常用义、800句自然双语，前6300词均覆盖。完整20000词仍未逐条语言编辑。保留学习编号、原词头顺序和完整词典定义，范围外对象与行业场景不变。

default区分默认设置与违约，aerial区分航拍和英式天线，presently区分目前与不久。hmm改为思考语气词，Gloria、Saunders、Vic等优先注明常见姓名用法，保留原词典专业义。医学词仅作沟通和描述，未提供诊断或治疗建议。

本批适当测试、实际浏览器检查、私有仓库整仓核验、上线回执与资源快照见/tmp/english-quest-v1283-evidence/verification.json。仅语言内容变化，没有重复并发或小屏布局验收。真实支付仍关闭，44音标专业逐条听审仍待完成。


## v1.28.4 主线推进到6700词

第6301–6700词新增400个常用中文义和800句自然双语，前6700词均有常用义和两句双语。完整20000词仍未逐条语言编辑。保留学习编号、词头顺序、完整原词典定义，范围外词条及行业场景不变。

tablet区分平板电脑与药片，moonlight区分月光与兼职，conserve采用常用的节约、保护义；broccoli修正为西兰花，outreach采用主动联络和社区服务义。专名、缩写、罕见形式及强烈粗俗口语注明性质。跨代理审读修正了landowner译文添加未发生行为、data breach搭配、tablet药品包装语境等问题。

适当测试、实际浏览器核验、私有仓库整仓字节比较及发布资源回执见/tmp/english-quest-v1284-evidence/verification.json。本批仅语言内容变化，未重复并发或小屏布局验收。真实支付仍关闭，44音标专业逐条听审尚未完成。

## v1.28.5 主线推进到7100词

第6701–7100词新增400个常用中文义和800句自然双语，主线前7100词现在每词都有简短中文义和两句双语。完整20000词仍在逐条编辑。学习编号、词头顺序和完整原词典定义保留，范围外词条及行业场景内容不变。

weekday改为工作日，thwart改为阻止、挫败；SSR补充开发中常用的服务端渲染。overtime区分加班与加时赛，pod区分豆荚与海豚群。人名、国家代码、历史机构和罕见纺织词注明用途。交叉审读修正了社交用语、martyr中译和例句未覆盖到的常用义，未用统一模板凑句子。

本批测试、实际浏览器核验、私有仓库整仓字节比较和发布资源回执见/tmp/english-quest-v1285-evidence/verification.json。只有语言内容改动，未重复并发或小屏布局验收。真实支付仍关闭，44音标专业逐条听审尚未完成。

本批罕见词与缩写核对来源：[Merriam-Webster的ye](https://www.merriam-webster.com/dictionary/ye)、[kemp](https://www.merriam-webster.com/dictionary/kemp)、[mungo](https://www.merriam-webster.com/dictionary/mungo)、[Collins的cor](https://www.collinsdictionary.com/dictionary/english/cor)、[Vue官方SSR说明](https://vuejs.org/guide/scaling-up/ssr)。THA对应Thailand见[MIT论文附表A.1](https://ceepr.mit.edu/wp-content/uploads/2021/09/2018-013.pdf)。本站句子为独立编写，没有复制词典例句。重建命令为`python3 qa/curate_main_6701_7100.py --apply`。

本批42项Go测试通过（6.946秒）、vet、前7100词核心及8112行业句子目标检查、app.js语法检查通过；47项隔离四账号检查通过。实际预览展开durable、lousy、Lenin、weekday两句双语，weekday播放按钮已点击，主线0词保持，无控制台错误。


## v1.28.6 罕见词与异体核对来源

[limo词典释义](https://www.ahdictionary.com/word/search.html?q=limo)用于修正原中文“柠檬”；[Oxford的bach](https://www.oxfordlearnersdictionaries.com/definition/english/bach)核对新西兰度假小屋用法；[Collins的Dee](https://www.collinsdictionary.com/dictionary/english/dee)核对人名用法；[Boswell](https://www.collinsdictionary.com/dictionary/english/boswell)核对传记作者引申义；[wheeler](https://www.collinsdictionary.com/zh/dictionary/english/wheeler)核对带轮车辆的复合形式。本站例句独立编写，没有复制词典例句。


## v1.28.6 主线推进到7900词

第7101–7900词新增800个常用中文义和1600句自然双语，主线前7900词现每词都有简短中文义和两句双语。完整20000词仍在逐条编辑。原学习编号、词头顺序和完整词典定义保留，范围外词条、行业与场景内容保持不变。

limo修正为豪华轿车，cranberry为蔓越莓，console补游戏机；Bach、Wagner、Dee等专名注明。两轮审读修正同声传译搭配、部分习语义、语气词和不自然中译；罕见用法保留真实语域，不用统一模板凑句子。

本批42项Go测试通过（5.227秒）、vet、前7900词核心与8112行业句子目标检查、app.js语法检查通过；47项隔离四账号检查通过。实际预览展开footprint、paranoid、kinship、limo两句双语，并点击播放按钮，主线0词保持，无控制台错误。limo模糊搜索同时匹配limousine，已定位实际目标核验。只有内容变化，未重复并发或小屏布局验收。

私有仓库整仓字节核验及生产发布结果见/tmp/english-quest-v1286-evidence/verification.json。真实支付仍关闭，44音标专业逐条听审尚未完成。


## v1.28.7 词义核验来源

- [LSEG富时100指数](https://www.lseg.com/en/ftse-russell/indices/ftse100)：原FTSE移植物释义不适合作为常用义。
- [IUPAC西门子单位](https://goldbook.iupac.org/terms/view/S05657)：电导单位与同名公司分开理解。
- [Collins doo](https://www.collinsdictionary.com/us/dictionary/english/doo)：苏格兰方言鸽子；角色名组成另标语域。
- [Cambridge paragraph](https://dictionary.cambridge.org/us/dictionary/english/paragraph)：para为paragraph书面缩写。

例句由本站独立编写，未复制来源例句。来源核对不替代每条用法的语言审读。


## v1.28.7 主线推进到8500词

第7901–8500词新增600个常用中文义和1200句自然双语，主线前8500词现每词都有简短中文义和两句双语。完整20000词仍在逐条编辑。原学习编号、词头顺序和完整词典定义保留，范围外词条、行业与场景内容不变。

本批校正blueberry为蓝莓、FTSE为富时指数，stakeholder采用利益相关方的现代常用义；worldview、downplay和fatality等句子经过交叉审读，专名、缩写、方言和粗俗用法注明性质。编辑原稿每100词一份TSV，`qa/curate_main_7901_8500.py --apply`可恢复本批内容。

42项Go测试通过（5.225秒）、vet、前8500词核心与8112行业句子目标检查、app.js语法检查通过；47项隔离四账号检查通过。实际预览展开blueberry、loophole、worldview和stakeholder的两句双语，并点击播放按钮，主线0词保持，无控制台错误。仅内容变化，未重复并发或小屏布局验收。

发布结果、仓库字节核验和资源采样见 `/tmp/english-quest-v1287-evidence/verification.json`。真实支付仍关闭，专业音标听审和完整主线逐词编辑尚未完成。

## v1.28.8 词义核验来源

本批例句为本站编写；以下辞典仅用于核对词义、语域和用法，没有搬用辞典例句。

- [Cambridge：squadron](https://dictionary.cambridge.org/dictionary/english/squadron)：飞行或海军中队，不一概译成整支舰队。
- [Cambridge：paramedic](https://dictionary.cambridge.org/us/dictionary/english/paramedic)：急救医护人员，修正原词典中的伞兵军医释义。
- [Cambridge：pretest](https://dictionary.cambridge.org/dictionary/english/pretest)：正式测试之前的测试，不是预测。
- [Oxford：macho](https://www.oxfordlearnersdictionaries.com/us/definition/english/macho)：通常带批评意味的强悍男性气概，修正原词典的疾病义。
- [Dictionaries of the Scots Language：monie / mony](https://www.dsl.ac.uk/entry/snd00076823)：many 的苏格兰语形式，注明方言性质。


## v1.28.8 主线推进到9100词

第8501–9100词新增600个常用中文义和1200句自然双语，主线前9100词现每词都有简短中文义和两句双语。完整20000词仍需继续编辑，尚余10900词。原学习编号、词头顺序和完整词典定义保留，范围外词条、行业与场景内容不变。

本批修正bailout的财政救助、paramedic的急救医护人员、pretest的前测及macho的现代常用义。squadron注明中队或分舰队；mony注明苏格兰方言。专名、缩写、历史用法和强冒犯性词语均说明性质，侮辱词例句只用于辨识语域。三份作者批次冻结后逐条交叉审读，修正thrift商店过窄译法及部分搭配；每100词一份编辑原稿，`qa/curate_main_8501_9100.py --apply`可恢复。

42项Go测试通过（5.072秒）、vet、前9100词核心与8112行业句子目标检查、app.js语法检查通过；47项隔离四账号检查通过。实际预览展开bailout、paramedic、macho和resilience的两句双语，并点击播放按钮，主线0词保持，无控制台错误。仅内容变化，未重复并发或小屏布局验收。

正式发布、仓库逐文件核验和资源采样的回执见本机`/tmp/english-quest-v1288-evidence/verification.json`。真实支付宝配置及本人试付、社交主页和微信群联系方式、协作者通行密钥验证仍待本人处理。结构检查和逐词编写不等于全库专业语言审校完成。

## v1.28.9 缩写与词义核验

- [NHGRI PCR 词条](https://www.genome.gov/genetics-glossary/Polymerase-Chain-Reaction-PCR)：PCR是扩增特定DNA片段的实验室技术，不仅指某一种病毒检测。
- [苏格兰职业资格说明](https://www.sqa.org.uk/sqa/2.html)与[Aena机场目录](https://www.aena.es/en/airlines/airports-and-destinations/our-airports.html)：SVQ在职业教育和航班语境有不同含义，两句分别示范，不能只靠缩写判定。
- [WHO缩写说明](https://www.who.int/docs/default-source/documents/about-us/transformation/who_transformation_update_-29jan2020.pdf)：WHA为世界卫生大会；[Medicaid官网](https://www.medicaid.gov/medicaid)说明美国医疗补助项目。例句不承诺任何人的资格。
- [皇家莎士比亚剧团](https://www.rsc.org.uk/about-us)、[德国社民党纲领](https://www.spd.de/fileadmin/Dokumente/Beschluesse/Grundsatzprogramme/hamburger_programm_englisch.pdf)核对RSC和SPD；[制造商无碳复写纸说明](https://www.telepaper.com/products/ncr-carbonless-paper/)核对NCR。
- [民间舞资料](https://www.cdss.org/elibrary/dart/introduction.htm)核对contra dance；[Anthony Caro官网](https://www.anthonycaro.org/about)核对人名；[球队官网](https://www.mfc.co.uk/news/2025/august/11/open-training-session-next-monday/)核对Boro昵称。
- [Macurco原厂操作手册的经销商存档](https://www.alarmax.com/customer/docs/skudocs/macurco-cx-xx-operation-manual-rev-2-1-0-.pdf)使用bUZ表示蜂鸣器设置。buz只作为少见的设备缩写介绍，不教成普通动词。

这些资料用于核对词义，本站例句另行编写。医疗、法律句子只示范语言用法。


## v1.28.9 主线推进到9700词

第9101–9700词新增600个常用中文义和1200句自然双语，主线前9700词现每词都有简短中文义和两句双语。完整20000词尚余10300词继续编辑。编号、词头顺序和完整原词典定义保留，范围之外的词条、行业与场景内容不变。

本批把relive改为重温、genus注明生物分类的属，adamant采用坚决的现代用法，cumin改为孜然，publicist采用宣传公关人员；sushi不再概括成生鱼片。SVQ分别示范机场代码和职业资格，PCR与WHA注明技术和机构语境；少见缩写不冒充日常实义词。三份作者批次冻结后，逐条审读600词1200句，修正移民居留身份、预订事故与人手不足等译文。每100词一份原稿，`qa/curate_main_9101_9700.py --apply`可重建。

42项Go测试通过（6.276秒）、vet、前9700词核心与8112行业句子目标检查、app.js语法检查通过；47项隔离四账号检查通过。实际预览展开genus、adamant、cumin和sushi的两句双语，并点击例句播放按钮，主线0词保持，无控制台错误。仅内容变化，未重复并发或小屏布局验收。

发布、私有仓库逐文件核验和资源采样的回执见本机`/tmp/english-quest-v1289-evidence/verification.json`。真实支付宝仍待配置与本人试付，社交主页、微信群联系方式和协作者验证仍待本人处理。逐词编写与结构检查不等于全库专业语言审校完成。

## v1.29.0 主线推进到10300词

第9701–10300词新增600个常用中文义和1200句自然双语，主线前10300词现每词都有简短中文义和两句双语。完整20000词尚余9700词继续编辑。原学习编号、词头顺序和完整词典定义保留，范围外词条、行业与场景内容不变。

prosthesis采用假肢、人工假体，matchup改为对阵，generational采用代际，counterterrorism改反恐，grapefruit为葡萄柚；meltdown区分情绪崩溃与堆芯熔毁，burnout展示身心耗竭和工作倦怠。人名、地名、DER/LAS等缩写注明上下文，queer说明自我认同与冒犯语域。三份作者批次冻结后逐条审读600词1200句，修正rout胜负歧义、matchup势均力敌、feeble道歉译法和reliever救援投手用法。每100词一份编辑原稿，`qa/curate_main_9701_10300.py --apply`可重建。

42项Go测试通过（9.571秒）、vet、前10300词核心与8112行业句子目标检查、app.js语法检查通过；47项隔离四账号检查通过。真实预览搜索prosthesis、bagel、grapefruit和burnout，展开两句双语并点击例句播放按钮，主线0词保持，无控制台错误。两万词目标可查看10000之后的新词。仅内容变化，未重复并发或小屏布局验收。

私有仓库逐文件核验、生产发布和低负载资源采样见本机 `/tmp/english-quest-v1290-evidence/verification.json`。真实支付宝仍待配置与本人试付，主页、微信群联系方式和协作者验证仍待本人处理。逐词编写与结构检查不等于全库专业语言审校完成。

本批特殊含义核验来源：[NCI prosthesis](https://www.cancer.gov/publications/dictionaries/cancer-terms/def/prosthesis)、[Cambridge queer](https://dictionary.cambridge.org/dictionary/english/queer)、[ITU DER编码规则](https://www.itu.int/rec/T-REC-X.690/en)、[联合国 LAS](https://dppa.un.org/en/node/103474)、[WHO职业倦怠说明](https://www.who.int/standards/classifications/frequently-asked-questions/burn-out-an-occupational-phenomenon)、[Apple iPod历史公告](https://www.apple.com/newsroom/2022/05/the-music-lives-on/)。来源用于核对含义，例句为本站另行编写，职业倦怠沟通例句不作临床诊断。


## v1.29.1 主线推进到10900词

第10301–10900词新增600个常用中文义和1200句自然双语，主线前10900词现每词都有简短中文义和两句双语。完整20000词尚余9100词继续编辑。原学习编号、词头顺序和完整词典定义保留，范围外词条、行业与场景内容不变。

本批区分cervical颈部和宫颈、silicone硅胶与silicon硅、muzzle动物鼻口和口套；ledger采用账簿、vibe采用氛围、camcorder采用便携摄像机、bandwidth补充可用精力。人名、地名、SAE回邮信封和罕见单数auspice注明语境。三份作者原稿冻结后，逐条审读600义1200句，修正sweetly系动词搭配、subdue语境、agonizing不自然表达及backbencher职务范围。每100词一份原稿，`qa/curate_main_10301_10900.py --apply`可重建。

本批后端、词库目标与隔离四账号检查、浏览器核验结果见 `/tmp/english-quest-v1291-evidence/verification.json`。仅内容变化，不重复此前并发或小屏布局验收。真实支付宝配置与本人试付、社交主页和微信群联系方式、协作者验证仍待本人处理；完整主线专业语言审校与音标逐条听审尚未完成。

本批核验来源：
- [IUPAC dalton](https://goldbook.iupac.org/terms/view/D01514)：质量单位，保留完整旧词典但常用义不沿用过时定义。
- [英国议会 backbencher](https://www.parliament.uk/site-information/glossary/backbenches/)：不是政府部长或反对党前座发言人的议员。
- [Cambridge self-addressed envelope](https://dictionary.cambridge.org/dictionary/english/self-addressed-envelope)：SAE的回邮信封语境。
- [Collins langley](https://www.collinsdictionary.com/dictionary/english/langley)：辐射能量单位。
- [American Heritage comp](https://www.ahdictionary.com/word/search.html?q=comp)：免费赠品或免费提供。
- [auspice](https://www.dictionary.com/browse/auspice)：单数较罕见的吉兆用法。

本批已通过42项Go测试（6.232秒）、静态检查、前10900词核心数据与8112行业句子检查及47项隔离四账号检查。预览实际展开ledger、vibe、silicone、camcorder两句双语并点击播放，无控制台错误，主线0词保持。生产发布及私有仓库逐文件核对以本批verification.json回执为准；本批仅内容变更，未重复此前并发与小屏布局验收。


## v1.29.2 主线推进到11500词

第10901–11500词新增600个常用中文义和1200句自然双语，主线前11500词现每词都有简短中文义和两句双语。完整20000词尚余8500词继续编辑。原学习编号、词头顺序和完整词典定义保留，范围外词条、行业与场景内容不变。

本批区分complimentary的免费与赞许、clipboard的写字板与剪贴板、marquee的大帐篷与剧院招牌，percentile修正为百分位数，BSL注明英国手语。Goldberg按姓氏解释，mmm采用满意的语气词；人名、缩写、方言和少见形式说明语域。医学词例句围绕沟通与报告，不作诊断或用药建议。三份作者原稿冻结后逐句交叉审读，修正increment与forcibly搭配、部分译文添加的含义。每100词一份原稿，`qa/curate_main_10901_11500.py --apply`可重建。

本批后端、词库目标与隔离四账号检查、浏览器核验结果见 `/tmp/english-quest-v1292-evidence/verification.json`。仅内容变化，不重复此前并发或小屏布局验收。真实支付宝配置与本人试付、社交主页和微信群联系方式、协作者验证仍待本人处理；完整主线专业语言审校与音标逐条听审尚未完成。

本批核验来源：[NIST百分位数说明](https://itl.nist.gov/div898/handbook/prc/section2/prc262.htm)、[WHO DALY定义](https://www.who.int/data/gho/data/themes/mortality-and-global-health-estimates/global-health-estimates-leading-causes-of-dalys)、[英国政府BSL计划](https://www.gov.uk/government/publications/british-sign-language-5-year-plan-department-for-business-and-trade)。来源用于核对定义，例句为本站另行编写。

核验补充：[CPS manslaughter](https://www.cps.gov.uk/types-crime/violent-crime)、[GNU dup](https://www.gnu.org/software/libc/manual/2.26/html_node/Duplicating-Descriptors.html)、[Collins qqv](https://www.collinsdictionary.com/dictionary/english/qqv)、[Collins cose](https://api.collinsdictionary.com/dictionary/english/cose)、[Siemens HMI](https://www.siemens.com/en-gb/products/simatic-hmi/)、[Moodle LMS](https://docs.moodle.org/500/en/About_Moodle)、[RSPCA](https://www.rspca.org.uk/en/whatwedo/whoweare)。manslaughter不一概等同于过失杀人；少见形式注明语域，不冒充常用口语。

本批已通过42项Go测试（5.175秒）、静态检查、前11500词核心数据与8112行业句子检查及47项隔离四账号检查。预览实际展开furry、healthcare、broadband、blackberry两句双语并点击播放，无控制台错误，主线0词保持。生产发布及私有仓库逐文件核对以本批verification.json回执为准；本批仅内容变更，未重复此前并发与小屏布局验收。


## v1.29.3 主线推进到12100词

第11501–12100词新增600个常用中文义和1200句自然双语。主线前12100词都有简短常用义和两句双语，完整20000词尚余7900词继续编辑。学习编号、词头顺序和原完整词典定义保留，范围外词条、行业与场景内容不变。

本批区分多义词：unwind放松与展开、prune修剪与西梅干、privy知晓秘密与旧式厕所；修正rosary念珠、pallet托盘、donut甜甜圈等常用义。医学词例句用于就诊沟通与术语辨识，罕见拼写和冒犯性表达注明语域。三名作者冻结原稿后，逐条交叉审读600个简义、1200句双语，再生成词库；每100词一份原稿，`qa/curate_main_11501_12100.py --apply`可重建。

本批测试、仓库核验、浏览器与发布结果见 `/tmp/english-quest-v1293-evidence/verification.json`。只有内容变化，未重复此前并发与小屏布局验收。完整主线逐条语言编辑、音标专业听审、真实支付宝配置和本人试付、社交主页及微信群联系方式、协作者验证仍未全部完成。

本批疑难词核验：[NPS卡津文化](https://www.nps.gov/jela/learn/historyculture/from-acadian-to-cajun.htm)、[英国下议院](https://www.parliament.uk/commons/)、[EPA污水污泥与生物固体](https://www.epa.gov/biosolids/basic-information-about-sewage-sludge-and-biosolids)、[英联邦官方介绍](https://thecommonwealth.org/about-us)、[Collins eyeglass](https://www.collinsdictionary.com/dictionary/english/eyeglass)、[Cambridge headquarter](https://dictionary.cambridge.org/dictionary/english/headquarter)。panick为过时拼写，现代通常写panic；Til为芝麻的别称。来源用于定义辨识，例句由本站另行编写。

本批42项Go测试通过（5.421秒），vet、前12100词双语目标、8112行业句子目标、前端语法与47项隔离多账号检查通过。预览实际展开payback、biosolids、pallet、donut两句双语，payback播放按钮已点击，无控制台错误；主线0词保持。正式站核验与资源采样由本批verification.json记录。


## v1.29.4 主线推进到12700词

第12101–12700词新增600个常用中文义和1200句自然双语。主线前12700词都有简短常用义和两句双语，完整20000词尚余7300词继续编辑。学习编号、词头顺序和原完整词典定义保留，范围外词条、行业与场景内容不变。

本批整理painstaking细致、inflatable可充气、walleye大眼梭鲈、marshmallow棉花糖等现代常用义；区分cam凸轮与摄像机、cameo客串与浮雕宝石、disinterested公正不偏私，避免沿用旧词典里不适合当前用法的释义。心理治疗师不一概称医生，医学词用于术语辨识和沟通。专名、少见单数及可能冒犯的口语注明性质。三名作者冻结原稿后，逐条交叉审读600个简义、1200句双语，再生成词库；每100词一份原稿，`qa/curate_main_12101_12700.py --apply`可重建。

测试、仓库核验、浏览器与发布结果见 `/tmp/english-quest-v1294-evidence/verification.json`。只有内容变化，未重复此前并发与小屏布局验收。完整主线逐条语言编辑、音标专业听审、真实支付宝配置和本人试付、社交主页及微信群联系方式、协作者验证仍未全部完成。

本批疑难词参考：[Charing Cross官方车站页](https://www.nationalrail.co.uk/stations/london-charing-cross/)、[NIST logistic模型说明](https://www.nist.gov/publications/logistic-function-data-analysis-program-logit)、[NHGRI双胞胎术语](https://www.genome.gov/genetics-glossary/identical-twins)、[Brooklands协和式客机馆藏](https://www.brooklandsmuseum.com/discover/concorde/)、[American Heritage walleye](https://ahdictionary.com/word/search.html?q=walleye)、[Oxford disinterested](https://www.oxfordlearnersdictionaries.com/definition/english/disinterested)。gall未一概译成虫瘿，参考[明尼苏达大学推广中心](https://extension.umn.edu/garden-and-home/yard-and-garden/yard-and-garden-insects/insect-and-mite-galls)；strikeout棒球译文按[MLB出局术语](https://www.mlb.com/glossary/standard-stats/out)区分半局。来源核对与本站编辑不等于全库专业审校认证。

本批验证：42 项 Go 测试通过（7.321 秒），vet、前 12,700 词核心检查、8,112 个行业句子目标检查及前端语法检查通过；47 项隔离多账号检查通过。实际预览展开 painstaking、walleye、disinterested、marshmallow 的两句双语，点击例句播放，主线保持 0，控制台无错误。仅内容变更，未重复此前并发与小屏布局验收。发布回执以 /tmp/english-quest-v1294-evidence/verification.json 为准。


## v1.29.5 主线推进到13300词

第12701–13300词新增600个常用中文义和1200句自然双语。主线前13300词均有简短常用义和两句双语，完整20000词尚余6700词继续编辑。学习编号、词头顺序和原完整词典定义保留，范围外词条、行业和场景内容不变。

本批整理stanza诗节、lichen地衣、brunette深棕发女性、aria咏叹调、melanoma黑色素瘤、coursework课程作业、burrito墨西哥卷饼等用法，区分canine犬的与犬齿、router路由器与铣槽机、fleece羊毛与抓绒衣。autistic使用自闭症相关常用义，不沿用孤独或自我中心的旧解释。缩写、专名、少见单数和冒犯性语域注明性质。三名作者完成自审并冻结后，逐条交叉审读600个简义和1200句双语；修正breakout角色搭配、toughen语境、relent表达及XIV使用场景。每100词一份原稿，`qa/curate_main_12701_13300.py --apply`可重建。

42项Go测试、核心数据与行业句子检查、47项隔离四账号检查通过。浏览器实际展开autistic、stanza、coursework、burrito的两句双语并点击朗读；进度独立保存。仓库整仓核验与发布结果见 `/tmp/english-quest-v1295-evidence/verification.json`。只有内容变化，未重复此前并发与小屏布局验收。完整主线逐条语言编辑、音标专业听审、真实支付宝配置和本人试付、社交主页及微信群联系方式、协作者验证仍未全部完成。

本批疑难用法参考：[NHS自闭症说明](https://www.nhs.uk/conditions/autism/what-is-autism/)、[NIST psi换算](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)、[Smithsonian蓝草音乐](https://folkways.si.edu/bluegrass-folkways-american-roots-tradition/history/music/article/smithsonian)、[Oxford若虫](https://www.oxfordlearnersdictionaries.com/definition/english/nymph)、[Cambridge前缀pre-](https://dictionary.cambridge.org/dictionary/english/pre)、[Merriam-Webster femme](https://www.merriam-webster.com/dictionary/femme)、[Kew官网](https://www.kew.org/about-us/who-we-are)。


## v1.29.6 主线推进到13900词

第13301–13900词新增600个常用中文义和1200句自然双语。主线前13900词均有简短常用义和两句双语，完整20000词尚余6100词继续编辑。学习编号、词头顺序和原完整词典定义保留，范围外词条、行业和场景内容不变。

本批纠正throwback怀旧事物、flak批评或防空炮火、virtuoso演奏大师、beeper寻呼机或蜂鸣器、tangy酸爽、matte哑光等旧误义；区分ventilator呼吸机与respirator呼吸防护器，ADHD和MRI采用正确医学缩写。Aires是Buenos Aires地名的一部分；mimick标为非标准拼写，现代规范形式是mimic；过时冒犯性称呼只用于辨识语域。三名作者完成自审并冻结后，逐条交叉审读600个简义和1200句双语，修正forebear和passively表达、greenish颜色译文及anaerobic无氧条件。每100词一份原稿，`qa/curate_main_13301_13900.py --apply`可重建。

本批实际测试、浏览器、仓库整仓核验及发布结果见 `/tmp/english-quest-v1296-evidence/verification.json`。只有内容变化，未重复此前并发与小屏布局验收。完整主线逐条语言编辑、音标专业听审、真实支付宝配置和本人试付、社交主页及微信群联系方式、协作者验证仍未全部完成。


本批疑难词来源：Alamo与CFC按史迹官网和EPA资料；pont按南非英语词典；MRI按NHS，respirator按NIOSH；nat采用大学田野研究术语表，Dow采用指数编制机构定义。
- https://www.thealamo.org/
- https://www.epa.gov/ods-phaseout
- https://dsae.co.za/entry/pont/e05722
- https://www.nhs.uk/tests-and-treatments/mri-scan/
- https://www.cdc.gov/niosh/ppe/php/community-respirators-masks/types-of-respirators-and-masks.html
- https://hawksites.newpaltz.edu/natpwe/resources/nat-religion/
- https://www.spglobal.com/spdji/en/indices/equity/dow-jones-industrial-average/

本批42项Go测试通过（5.390秒），vet、前13900词核心检查、8112行业句子目标、前端语法和47项隔离四账号检查通过。隔离浏览器实际展开throwback、ventilator、beeper、cappuccino的两句双语，点击朗读，无控制台错误；主线0词保持。用户预览与生产验收回执由本批verification.json记录。


## v1.29.7 主线推进到14500词

第13901–14500词新增600个常用中文义和1200句自然双语。主线前14500词均有常用中文义和两句双语，完整20000词尚余5500词继续编辑。学习编号、词头顺序和原完整词典定义保留，范围外词条、行业和场景内容不变。

本批改正upload上传、firewall防火墙、layup上篮、carousel旋转木马等旧误义；区分header页眉与头球、materialistic物质至上与哲学唯物主义。专名、缩写和口语语域注明性质。三名作者完成自审并冻结后，逐条交叉审读600个简义和1200句双语；每100词一份原稿，`qa/curate_main_13901_14500.py --apply`可重建。

本批实际测试、浏览器、仓库核验和发布结果见 `/tmp/english-quest-v1297-evidence/verification.json`。只有内容变化，未重复并发与小屏布局验收。完整主线语言编辑、音标专业听审、真实支付宝配置与本人试付、社交主页及微信群联系方式、协作者验证仍未全部完成。

本批42项Go测试通过（5.664秒），vet、前14500词核心检查、8112行业句子目标、前端语法及47项隔离四账号检查通过。隔离浏览器实际展开upload、materialistic、layup、carousel两句双语，点击朗读，无控制台错误；主线0词保持。用户预览、仓库核验及生产结果由本批verification.json承接。

本批疑难词核对来源：
- https://www.fisheries.noaa.gov/species/steelhead
- https://dictionary.cambridge.org/dictionary/english/geordie
- https://www.nationalarchives.gov.uk/help-with-your-research/research-guides/domesday-book/
- https://www.merriam-webster.com/dictionary/condor
- https://www.hants.gov.uk/
- https://developer.mozilla.org/en-US/docs/Glossary/DOM
- https://www.collinsdictionary.com/dictionary/english/clint
- https://www.collinsdictionary.com/dictionary/english/gypsy
- https://datatracker.ietf.org/doc/html/rfc8866


## v1.29.8 主线推进到15100词

第14501–15100词新增600个常用中文义和1200句自然双语。主线前15100词均有常用中文义和两句双语，完整20000词尚余4900词继续编辑。学习编号、词头顺序和原完整词典定义保留，范围外词条、行业和场景内容不变。

本批改正hyena鬣狗、supersonic超音速、subprime次级信贷、cola可乐、facedown脸朝下等旧误义；区分mW毫瓦与MW兆瓦、神经性厌食症与神经性贪食症，GmbH为有限责任公司。专名、缩写和口语语域注明性质。三名作者完成自审并冻结后，逐条交叉审读600个简义和1200句双语；每100词一份原稿，`qa/curate_main_14501_15100.py --apply`可重建。

本批实际测试、浏览器、仓库核验和发布结果见 `/tmp/english-quest-v1298-evidence/verification.json`。只有内容变化，未重复并发与小屏布局验收。完整主线语言编辑、音标专业听审、真实支付宝配置与本人试付、社交主页及微信群联系方式、协作者验证仍未全部完成。

本批14501–15100疑难核验：forego为forgo变体见[American Heritage](https://www.ahdictionary.com/word/search.html?q=forego)；mW/MW大小写单位前缀见[BIPM](https://www.bipm.org/en/measurement-units/si-prefixes)；JS见[MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript)；HSE见[英国健康安全执行局](https://www.hse.gov.uk/aboutus/our-mission-and-priorities.htm)；ESA见[欧洲航天局](https://www.esa.int/Newsroom/About_the_European_Space_Agency)。

本批42项Go测试通过（5.325秒），vet、前15100词核心检查、8112行业句子目标、前端语法及47项隔离四账号检查通过。隔离浏览器实际展开hyena、subprime、nervosa、facedown两句双语，点击朗读，无控制台错误；主线0词保持。用户预览facedown两句展开和朗读已检查，仓库核验与发布结果由本批verification.json承接。


## v1.29.9 主线推进到15700词

第15101–15700词新增600个常用中文义和1200句自然双语。主线前15700词均有常用中文义和两句双语，完整20000词尚余4300词继续编辑。学习编号、词头顺序和原完整词典定义保留，范围外词条、行业和场景内容不变。

本批纠正measles麻疹、triathlon铁人三项、croissant可颂、pacemaker心脏起搏器与领跑员等常用义；GCC、DLP、POU、UCTA等缩写按出处和语境辨识，WHE缺少可靠扩写依据则明确待核。专名、罕见形式和口语语域注明性质。三名作者完成自审并冻结后，逐条交叉审读600个简义和1200句双语；每100词一份原稿，`qa/curate_main_15101_15700.py --apply`可重建。

本批42项Go测试5.145秒、vet、前15700核心及8112行业句子目标检查、脚本语法与47项隔离四账号检查通过。隔离浏览器实际展开measles、triathlon、croissant、pacemaker两句双语，并点击朗读；用户预览croissant展开播放。仓库核验和发布结果见 `/tmp/english-quest-v1299-evidence/verification.json`。只有内容变化，未重复并发与小屏布局验收。完整主线语言编辑、音标专业听审、真实支付宝配置与本人试付、社交主页及微信群联系方式、协作者验证仍未全部完成。


### v1.29.9疑难术语出处

本批对MMC、GCC、DLP、POU、Hib等按语境选义；旧WHE扩写缺少可靠原始依据，练习只辨识文档标记，不把推测当确定释义。

- [NHS psychosis](https://www.nhs.uk/mental-health/conditions/psychosis/)，精神病性状态。
- [Collins fundholder](https://www.collinsdictionary.com/dictionary/english/fundholder)，英国历史医疗预算制度。
- [GCC官方](https://gcc.gnu.org/)、[NRC PWR](https://www.nrc.gov/reactors/power/pwrs)、[CDC Hib](https://www.cdc.gov/hi-disease/index.html)。
- [NASA UCTA原始报告](https://ntrs.nasa.gov/api/citations/20200001583/downloads/20200001583.pdf)、[Texas Instruments DLP](https://www.ti.com/technologies/dlp-projection.html)、[AWS ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html)。
- [历史服装词典rever](https://www.gutenberg.org/cache/epub/76299/pg76299-images.html)、[Collins acet](https://www.collinsdictionary.com/dictionary/english/acet)、[美国大屠杀纪念馆swastika背景](https://encyclopedia.ushmm.org/content/en/article/history-of-the-swastika)。

根代理逐条审读600简义及1200句双语，修正fundholder比较对象、duplex双面打印、gumbo译文、amp搭配、plantain语境、rubbery鱿鱼与squelch湿响。作者和交叉审读结束后冻结TSV，应用后的JSON与最终原稿一致。

## v1.30.0 主线推进到16300词与预览恢复

第15701–16300词新增600个简短中文义和1200句双语用法。前16300词均有简明释义与两句双语，完整20000词尚余3700词继续编辑。编号、词头顺序、原完整词典定义、范围外词条及行业场景内容保留。三名作者自审并冻结后，逐条交叉审读600个简义与1200句双语；12份TSV和 `qa/curate_main_15701_16300.py --apply` 可重建本批数据。

本批整理sax萨克斯、sundae圣代、nirvana涅槃等常见义，区分python蟒蛇与编程语言、sandbox沙坑与沙盒环境。postpon说明古苏格兰语旧拼法，thril的原库释义缺少可靠依据，明确待核；NICH注明医学缩写和可靠出处。修正换挡的主语、细节与投诉的英文搭配，以及鱼类和鲸类例句中范围过宽的表述。逐词编写和结构检查不等于全词库专业语言审校完成。

2026年10月2日本机重启后，旧 `/tmp` 预览程序、测试状态和本地验收文件已丢失；这些历史路径仅记录当时的位置。正式站仍正常，未复制或更改正式站账号。预览已改用持久目录 `~/Library/Application Support/EnglishQuestPreview/`，登录当前macOS用户后自动启动，只使用模拟支付；旧临时测试账号没有恢复。可用 `scripts/install_preview_macos.py` 安装已在本机编译的程序。后续证据保存在项目已忽略的 `state/evidence-v1300/`。

本批测试与线上发布回执以 `state/evidence-v1300/verification.json` 为准。专业音标逐条听审、真实支付宝配置与本人试付、社交主页微信群联系、协作者验证仍待完成。本批未改布局或竞技规则，未重复此前并发和小屏布局验收。

本批疑难词来源：[NICH/NCBI MedGen](https://www.ncbi.nlm.nih.gov/medgen/698685)、[REALTOR/NAR会员商标](https://www.nar.realtor/membership-marks-manual/license-to-use-the-marks)、[postpon/旧苏格兰语](https://dsl.ac.uk/entry/snd/postpone)、[thril历史异体记录](https://dsl.ac.uk/entry/dost00086253)、[chaise](https://www.merriam-webster.com/dictionary/chaise)、[Sabine](https://www.merriam-webster.com/dictionary/Sabine)、[ell](https://www.merriam-webster.com/dictionary/ell)、[minutia](https://www.merriam-webster.com/dictionary/minutia)、[yardage](https://www.merriam-webster.com/dictionary/yardage)、[pansy冒犯语域](https://www.oxfordlearnersdictionaries.com/us/definition/english/pansy)。thril的历史异体不足以确认原库“联络小巷”的释义，例句只用于辨认词形。

本批42项Go测试通过（5.001秒），vet、前16300词核心检查、8112行业句子目标、前端语法及47项隔离四账号检查通过。隔离浏览器实际展开vegan、sandbox、nirvana、sundae的两句双语并点击朗读，主线0词保持，无控制台错误；持久预览19004的sundae也已展开和试播。仓库整仓核验、正式站结果和资源采样由本批verification.json记录。


## v1.30.1 主线推进到16900词

第16301–16900词新增600个简短常用中文义与1200句双语用法，主线前16900词现在均有常用义和两句双语，完整20000词还剩3100词继续编辑。三名作者自审并冻结后，再逐条交叉审读600个释义与1200句双语；12份TSV和 `qa/curate_main_16301_16900.py --apply` 可重建本批数据。

修正pinky小指、animator动画师、stoneware炻器、angina心绞痛、executor遗嘱执行人等旧简义，分别交代pol、vita、shalt和doldrum的语境；enchilada用玉米饼，不和面粉卷饼混教。pressurise、bisect和hairless的句子按实际用法改写，译文不增添原句没有的情节。原学习编号、词头顺序、完整词典定义、范围外词条与例句及行业场景内容保留；冻结原稿和JSON逐项一致。

本批42项Go测试4.679秒、vet、前16900词核心检查、8112行业句子目标检查和应用语法检查通过。四账号隔离验收、真实浏览器、仓库整包核验与生产发布结果见持久证据 `state/evidence-v1301/verification.json`。只改内容，不重复此前并发和小屏布局验收。全库18152词至少一句有中文，17528词两句有中文，这些数量不等同于全库专业语言审校完成；44音参考录音仍待专业逐条听审。

本批罕见形式及专业义核对：Merriam-Webster 的 [modus](https://www.merriam-webster.com/dictionary/modus)、[doldrum](https://www.merriam-webster.com/dictionary/doldrum)、[napa cabbage](https://www.merriam-webster.com/dictionary/napa%20cabbage)、[stoneware](https://www.merriam-webster.com/dictionary/stoneware)、[pol](https://www.merriam-webster.com/dictionary/pol)、[vita](https://www.merriam-webster.com/dictionary/vita)、[shalt](https://www.merriam-webster.com/dictionary/shalt)、[angina](https://www.merriam-webster.com/dictionary/angina)、[enchilada](https://www.merriam-webster.com/dictionary/enchilada)，以及 Oxford 的 [unflattering](https://www.oxfordlearnersdictionaries.com/definition/english/unflattering)。这些来源用于核对含义；本批句子由本站编写，没有抄录词典例句。

## v1.31.0学习工具验收

新增 `study-core.test.js`、`study-practice.test.js`、`study-speaking.test.js`、`study-tools-contract.test.js`，配合原7套前端检查。合约测试使用模拟DOM和Blob，不当作真实图片导出或真人发音验收。`study-api-smoke.py`仅可对本机隔离端口运行，检查账号隔离、Owner拒绝、冲突和持久化。Go新增学习资料结构、账号绑定、AI代理隐私和异步同步测试。所有测试数据不可迁到正式站。

实际浏览器检查覆盖创建句子库、收藏笔记、整句听写、日历和PNG下载；PNG实际下载后解码与目视检查。1366×620、390×844检查答题与口语操作可见。录音和识别的自动化测试使用模拟音频，不能当成真人发音评分或专业听审。AI生产联调须实际获得上游回复再记成功，503或示例回复不算通过。证据在已忽略的 `state/evidence-v1310/`；最终服务版本、测试数及发布回执以verification为准。

本批最终检查：55项Go测试通过（7.616秒），完整并发检测通过（76.250秒），vet通过；11套前端检查、47项隔离四账号检查和20项学习工具接口检查通过。桌面1366×620及手机390×844口语页面无输入区遮挡；深色和打乱顺序设置保存后刷新可恢复。语音识别、录音的自动化检查使用模拟设备，实际麦克风授权与录音试听由使用者完成，不作为发音评分。真实AI供应商短请求已返回，正式站两轮口语对话及发布结果由state/evidence-v1310/verification.json记录。


## v1.31.1 主线推进到17500词

第16901–17500词新增600个简短常用中文义、1200句双语用法。前17500词都有常用义和两句双语，完整20000词还剩2500词继续编辑。三名作者自审并冻结后，逐条交叉审读600个释义与1200句双语，再生成词库。12份TSV与 `qa/curate_main_16901_17500.py --apply` 可重建本批内容。

本批修正probate遗嘱认证程序、rhinestone仿钻石饰品、congregant宗教会众成员、potluck各自带菜聚餐、stardust星尘及魅力等旧义；buzzard与sycamore注明英美区别，TAI采用国际原子时的官方缩写。alm只确认德语高山牧场，明确英语词头性质待核；少见词与冒犯用语不当作普通口语。原学习编号、词头顺序、完整词典定义、范围外词条与例句及十行业内容保留；最终TSV与JSON一致。

全库18543词至少一句有中文，18019词两句有中文；这些是译文覆盖数量，不代表全库专业语言审校完成。已有听写、口语和个人学习工具继续使用；没有加入视频。本批测试、实际浏览器、仓库同步核对及发布结果以 `state/evidence-v1311/verification.json` 为准。仅内容和加载版本变化，未重复此前并发和小屏布局验收。

疑难词核对来源：[MW buzzard](https://www.merriam-webster.com/dictionary/buzzard)、[Oxford sycamore](https://www.oxfordlearnersdictionaries.com/us/definition/english/sycamore)、[Cambridge Alm德英条目](https://dictionary.cambridge.org/us/dictionary/german-english/alm)、[BIPM TAI](https://www.bipm.org/en/time-department/utc)、[MW Mongol](https://www.merriam-webster.com/dictionary/Mongol)、[Cambridge potluck](https://dictionary.cambridge.org/dictionary/english/pot-luck)、[NASA星尘](https://www.nasa.gov/news-release/silicate-stardust-traces-histories-of-dust-in-the-galaxy/)、[IFRS materiality](https://www.ifrs.org/issued-standards/list-of-standards/materiality-practice-statement/)。

本批55项Go测试通过（6.254秒），vet、前17500词核心数据、8112行业句子目标和应用语法检查通过；47项全新隔离四账号检查通过。隔离浏览器实际展开rhinestone、probate、potluck、weeknight的两句双语，点击weeknight例句朗读，主线0词保持，无控制台错误。本批没有重新运行并发及小屏布局检查。


## v1.31.2 主线推进到18100词

第17501–18100词新增600个简短常用中文义、1200句双语用法。前18100词都有常用义和两句双语，完整20000词还剩1900词继续编辑。三名作者自审并冻结后，逐条交叉审读600个释义与1200句双语，再生成词库。12份TSV与 `qa/curate_main_17501_18100.py --apply` 可重建本批内容。

纠正 honeysuckle 忍冬、slaw 凉拌卷心菜丝、greyhound 灵缇犬、panache 潇洒气派、striper 条纹鲈和 darby 抹灰长抹板等旧误义。biweekly 两种频率分别写清；disinterest 区分不感兴趣与不偏不倚。pinto 区分花斑马与斑豆，Petri dish 采用培养皿语境，Que. 为魁北克缩写。术语、专名与可能冒犯的表达注明语域；顺势疗法只作术语辨识。根审读修正 cogent、nub、mutilate、hutch 和运动术语中译，去掉十三时钟面的辨识句，改成真实铭文语境。

原学习编号、词头顺序、完整词典定义、范围外词条与例句及十行业内容保留；最终TSV与JSON一致。全库18909词至少一句有中文，18518词两句有中文；这些是译文覆盖数量，不代表全库专业语言审校完成。已有听写、口语和个人学习工具继续使用；没有加入视频。本批测试、实际浏览器、仓库同步核对及发布结果以 `state/evidence-v1312/verification.json` 为准。仅内容和加载版本变化，未重复此前并发和小屏布局验收。

疑难词核对来源：[Merriam-Webster forestal](https://www.merriam-webster.com/dictionary/forestal)、[preexist](https://www.merriam-webster.com/dictionary/preexist)、[Mont](https://www.merriam-webster.com/dictionary/mont)、[ISO UNE](https://www.iso.org/member/1717.html)、[Cambridge poly](https://dictionary.cambridge.org/dictionary/english/poly)、[Merriam-Webster hogan](https://www.merriam-webster.com/dictionary/hogan)、[pinto](https://www.merriam-webster.com/dictionary/pinto)、[hutch](https://www.merriam-webster.com/dictionary/hutch)、[kindergartner](https://www.merriam-webster.com/dictionary/kindergartner)、[baccalaureate](https://www.merriam-webster.com/dictionary/baccalaureate)、[Collins Que](https://www.collinsdictionary.com/dictionary/english/que)、[Merriam-Webster striper](https://www.merriam-webster.com/dictionary/striper)、[Cambridge biweekly](https://dictionary.cambridge.org/dictionary/english/biweekly)、[NHGRI eugenics](https://www.genome.gov/genetics-glossary/Eugenics)、[Merriam-Webster darby](https://www.merriam-webster.com/dictionary/darby)、[petit](https://www.merriam-webster.com/dictionary/petit)、[Petri dish](https://www.merriam-webster.com/dictionary/Petri%20dish)、[disinterest](https://www.merriam-webster.com/dictionary/disinterest)、[Collins Mae](https://www.collinsdictionary.com/dictionary/english/mae)、[Starbucks grande](https://www.starbucks.com.sg/frequently-asked-questions-in-our-stores)。词典与机构来源只支持术语或词义核实，两句均为本站编写，未复制来源例句。

本批55项Go测试（6.492秒）、vet、前18100词核心目标与8112行业句子检查、专项前端检查、app语法和47项全新隔离四账号检查通过。19005实际展开persimmon、biweekly、disinterest、acclimate的两句双语，点击例句朗读按钮，控制台无错误，主线保持0。disinterest模糊搜索同时返回disinterested，已用唯一中文义定位实际目标再核验。仅内容变更，未重跑此前并发、小屏布局或真实AI请求；点击朗读不等同真人听审。

## v1.31.3 主线推进到18700词

第18101–18700词新增600个简短常用中文义、1200句双语用法。前18700词都有常用义和两句双语，完整20000词还剩1300词继续编辑。三名作者自审冻结后，整批交叉审读600个释义、1200句双语；修改22处字段后再次冻结。12份TSV和 `qa/curate_main_18101_18700.py --apply` 可重建内容。

本批纠正crummy、quince、hippocampus、cabinetry等旧误义；hornet用胡蜂避免与熊蜂混淆，ultrasonic与supersonic区分，homespun不误写为现代家纺产品。QUI、RVE等缩写按具体语境说明，古旧词、地名、姓名和冒犯性表达标明性质。审读修掉译文擅加“很快”“已经完成”等信息，并调整糖精炼企业、杜鹃卵等语境。

原学习编号、词头顺序、完整词典及范围外词条和例句保留；365个既有data文件中只有words/examples变化，十行业内容不变。最终12份TSV与JSON逐项一致；独立检查确认两程序各五份公开资源完整字节匹配10/10。全库19261词至少一句有中文、18997词两句有中文；这是译文覆盖数量，不表示整份词库专业审校完成。44音参考录音的专业逐条听审和真人录音试听仍未验收。

本批55项Go测试（6.531秒，另有20个子测试通过）、vet、前18700词核心目标、8112行业句子目标、专项前端、app语法和47项全新隔离四账号检查通过。19005实际展开hornet、miso、motherboard、guacamole两句双语；miso用唯一中文义定位。guacamole朗读按钮44px，中心命中朗读，实际点击后收藏仍为☆，控制台无错误，主线保持0。只改内容和加载版本，未重跑此前全量并发、小屏布局或真实AI付费请求；播放点击不替代真人听审。

本批预览、整仓同步和发布结果以 `state/evidence-v1313/verification.json` 为准。脚本与词库入口分别更新为app?v52、words?v12、examples?v11；正式浏览器普通刷新后确认取到新内容。既有听写、口语和学习工具继续保留，不添加视频。


本批术语核验来源：

- [Merriam-Webster hornet](https://www.merriam-webster.com/dictionary/hornet)、[homespun](https://www.merriam-webster.com/dictionary/homespun)、[combustible](https://www.merriam-webster.com/dictionary/combustible)与[Collins maul](https://www.collinsdictionary.com/dictionary/english/maul)：胡蜂类别、家织用法、可燃与攻击用法。
- [Oxford UK Biobank QUI](https://biobank.ndph.ox.ac.uk/ukb/field.cgi?id=4123)与[Sandia RVE](https://www.sandia.gov/files/sierra/SM_Development_5_22/main/rve.html)：定量超声指标与代表性体积单元；旧RVE雷达扩写未核实，不当确证用法。
- [Getty forcep](https://www.getty.edu/vow/AATFullDisplay?subjectid=300400465)、[Collins lowry](https://www.collinsdictionary.com/dictionary/english/lowry)、[stepney](https://www.collinsdictionary.com/dictionary/english/stepney)：非优选单数、少见拼写及印度备用轮胎用语。
- [Cambridge hippocampus](https://dictionary.cambridge.org/dictionary/english/hippocampus)、[Merriam-Webster ultrasonic](https://www.merriam-webster.com/dictionary/ultrasonic)、[NASA occultation](https://science.nasa.gov/universe/exoplanets/an-eclipse-by-any-other-name-doing-science-with-transits-and-occultations/)：海马、超声及天体掩星术语。
- [Merriam-Webster pur](https://www.merriam-webster.com/dictionary/pur)、[aga](https://www.merriam-webster.com/dictionary/aga)、[aureus](https://www.merriam-webster.com/dictionary/aureus)、[Collins palais](https://www.collinsdictionary.com/dictionary/english/palais)：古旧形式、称号、金币及旧式舞厅义。
- [Merriam-Webster cabinetry](https://www.merriam-webster.com/dictionary/cabinetry)、[hula](https://www.merriam-webster.com/dictionary/hula)、[Oxford bugger](https://www.oxfordlearnersdictionaries.com/definition/english/bugger_1)：橱柜工艺、夏威夷传统舞蹈与冒犯语域。
