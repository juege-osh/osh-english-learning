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

`codes_test.go` 覆盖站长生成、登录兑换、月卡30天/年卡365天/永久权益、重启及重复使用拒绝。`community_test.go` 覆盖主页保存、入群信息的权限隔离、过期权益和不安全链接拒绝。`scripts/qa_smoke.py` 现有35项隔离多账号检查；不可对正式站运行。

`programmer_reviewed.tsv` 是新增583个程序员词的行业释义，结合原100个起步词形成683词完整精选池；`programmer_examples.tsv` 为原100个起步词提供200句原创双语开发用语。重建时运行 `python3 build_industries.py`，缺词头、重复词头、缺译文、句子不含目标词都会拒绝写入。词条ID沿用主线，行业排序变化不会改主线关卡。

`industry-practice.test.js` 覆盖动态数量、句子选词、行业例句朗读文本、独立进度、专项错词复习及删除词过滤。`progress-sync.test.js` 检查不同设备按最近专项答案合并；同一时间的冲突保留错误，避免丢失待复习词。Go检查覆盖行业释义与选项、四条编辑路线的精选词进入榜单、新旧题库成绩隔离、旧题提交被拒绝且不消耗机会。

`ai_creator_reviewed.tsv`新增731个AI创作词，结合起步词形成831词；`healthcare_reviewed.tsv`新增653个医疗健康词，合成753词。两份对应的`*_examples.tsv`各有100词的200句双语用法。重建仍使用`build_industries.py`，不自动添加无关词凑数。医学释义面向英语学习，对话以问诊沟通为主。

`industry_confusables.json`按路线保存近义词组，构建时解析成有效词ID；句子选词排除这些组及相同中文义，英中选义不受影响。前端检查覆盖全部422个有例句的行业词、四个互异选项、专项错词徽标和跨路线进度。

`biology_reviewed.tsv`与原起步词合成967词，替换了生物试练池。`biology_examples.tsv`为122词提供244句原创双语实验室、野外沟通用语。术语参考NHGRI遗传学词汇表，中文释义由本站编写。

`data/industry_words.json`单独收录245个主线缺少的专业词，ID从20001开始，只追加，不能重编号或复用旧ID。主线words.json始终20,000词；首100个行业词顺序及考试词池沿用原内容。构建脚本按行业编辑表增加缺词，二次构建的输出字节相同。行业查询同时识别主线词和补充词，通用每日榜与单排/双排仍只使用主线词库。

新增检查覆盖补充词在专项题与榜单中出现、主线每日榜排除它们、服务重启后读取账号专项记录、跨设备最新答案合并、搜索大小写与中文、指定词句子练习及错词徽标。静态文件检查也确认补充词库已打包；页面不依赖启动时联网取词。主线词库、例句和场景文件与本轮之前逐字节相同。
