# 词库数据

主线词库、例句、场景和行业专项数据保存在本目录。来源、许可及生成方式见上级目录 provenance/ 和项目说明。

以下为早期前1,100词的编辑记录。后续主线批次及准确覆盖量见项目根目录README和qa/README，重建时还须按顺序执行qa/curate_main_*.py；不要只执行本页早期脚本。

前 1,100 个主线词有简短中文义和两句双语例句；第 701–800 词有 46 个、第 801–900 词有 33 个、第 901–1000 词有 50 个、第 1001–1100 词有 38 个仍沿用语料原句，早期尚未逐句审读；v1.31.7现已连同本站例句完成本范围400词800句逐条编辑审读。重建词库后依次运行 `qa/curate_first500_glosses.py`、`qa/curate_next200_glosses.py --apply`、`qa/curate_next100_glosses.py --apply`，然后依次运行 `qa/curate_next100_glosses_801_900.py --apply`、`qa/curate_next100_glosses_901_1000.py --apply` 和 `qa/curate_next100_glosses_1001_1100.py --apply`；例句的第 501–700 词由 `qa/curate_next200_examples.py --apply` 恢复，第 701–1100 词再按顺序运行各批 `qa/curate_*_example_gaps.py --apply`。原词典释义仍保存在每条词的 `full` 字段。每批人工改写的句子都保留在相应 TSV 文件中。

第 847 词 `de` 是词频源混入的外语连接词，并非常用英语独立单词。当前只修正了展示释义和例句；保留稳定学习ID；是否调整词频源混入形式须另行核实，并先设计进度迁移，不能直接替换或复用编号。

第 1024 词 `ii` 的例句都是罗马数字 II，第 1061 词 `smith` 的例句都是姓氏 Smith。现已修正展示释义，但它们是否应占用通用词量名额仍需复核；若调整词条，必须同步处理按词编号保存的进度。

## v1.31.7质量编辑层

原始批次重建结束后运行 `python3 qa/review_main_701_1100.py --apply`。四份 `qa/reviewed_examples_*.json` 记录64词71个具体修订、原值和理由；重复应用字节稳定，遇到非原值或非已校订值会拒绝写入。原外部句ID、作者、译文ID和译者保留，原文原译与本站校订分开标明；范围外19600词及行业内容保持。167词334句外部语料是本次审读范围，不是新增量，也不代表全库专业语言审校。


## v1.31.8：核查待核词，修正英英题错义

本批核查keye、thril、WHE、Alm、de和II的原词库字段、历史字形及外语性质。上游固定版本ECDICT完整CSV的SHA256与项目原记录一致；rank按frq优先、缺时bnc取值，不是学习ID，也不能证明现代常用程度。词表只做有限规则过滤，仍含专名、外语成分、缩写和历史形式。

保留所有词号、词头顺序和原词典正文，实际修8词15字段。router、firewall和cola的英英题不再用派送工人、最大推力和植物属义；分别采用网络设备、安全规则与可乐饮料义。de取消错配的特拉华州英英义和单一英语音标，Alm识别句按德语名词大写并撤下错配音标。keye补充中古英语key字形记录，thril注明历史异体；原医用、小巷和WHE工程扩写仍待核，不因找到同形缩写就宣布核实。

四份 `qa/research_*_v1318.json` 保存已核来源与支持边界；`qa/reviewed_auxiliary_v1318.json` 保存具体前后值。重建所有历史编辑层后，先恢复701–1100质量修订，再运行 `python3 qa/review_auxiliary_v1318.py --apply`。正确句子保留，不替换旧ID或继承成别的词的学习进度。

主线20000词、40000双语例句和十行业8112路线条目、16224行业双语例句的覆盖量保持；覆盖不等于全库专业审校。英英辅助定义尚未全量审读，44音专业听审、真人录音试听及真实支付仍未完成。本批测试、整仓同步、预览与正式发布结果见 `state/evidence-v1318/verification.json`。

核义参考：[ECDICT固定源文件](https://github.com/skywind3000/ECDICT/blob/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/ecdict.csv)、[Mayhew与Skeat中古英语词典](https://www.gutenberg.org/cache/epub/10625/pg10625-images.html)、[古苏格兰语词典](https://dsl.ac.uk/entry/dost00086253)、[Collins德语Alm](https://www.collinsdictionary.com/dictionary/german-english/alm)、[Cisco路由器](https://www.cisco.com/site/us/en/learn/topics/small-business/what-is-a-router.html)、[Cisco防火墙](https://www.cisco.com/site/us/en/learn/topics/security/what-is-a-firewall.html)、[Oxford cola](https://www.oxfordlearnersdictionaries.com/definition/english/cola)。其他原始资料及访问限制见四份research记录，不把未打开或邻近字形资料当作确定原义。

本批检查通过：62项顶层Go、20个子测试（6.871秒）、vet、20k核心、8112行业句子目标、12项实际函数英英出题与判分、8项来源渲染、47项全新隔离四账号检查。47项不含站长审核预约；支付为模拟。Mac/Linux各77完整嵌入资源共154项字节匹配。隔离页面实际展开keye、thril、WHE与Alm性质/双语；19004实际展开Alm并点击44px朗读，收藏保持☆，未做真人听审。仅内容与来源说明变更，未重复全量race、全套前端、小屏布局或付费AI请求。

## v1.31.9：第8章英英辅助定义质量审读

本批逐项对照主线7001–7600共600词的英文定义、现有中文义及1200句英文语境，修257个en字段：251条定义改为对应当前用法，另六项错配专名或无法可靠出题的定义清空，按现有规则回退中文选择题。正确的314项和原空值29项保留。mortar不再用迫击炮解释砂浆/研钵，coax不再用同轴线解释劝说，lest不再误为五十；zip、blockbuster、puddle分别对应拉链、卖座作品和地面水洼。

只改英文辅助字段。学习ID、词头顺序、中文常用义、原完整词典、音标、所有例句和行业题库保留。全部20,000词的两句双语覆盖保持；本批600词审读不代表全词库专业语言审校完成。44音专业听审、真人麦克风授权和录音试听尚未完成。

三份分段审稿及最终补丁已冻结。重建时，在所有历史编辑层、701–1100质量补丁和v1318来源补丁之后运行 `python3 qa/review_definitions_7001_7600.py --apply`；此脚本只写words.json，不写examples.json。实际产品第8章起仅对非空en出英英题；本批回归直接调用现有出题、渲染和判分函数。最终测试、普通浏览器刷新、私有仓库全文件核对和发布结果见 `state/evidence-v1319/verification.json`，不要把点击朗读当作真人音频听审。
