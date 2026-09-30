# 词库数据

主线词库、例句、场景和行业专项数据保存在本目录。来源、许可及生成方式见上级目录 provenance/ 和项目说明。

前 800 个主线词的简短中文义和两句双语例句已整理。重建词库后依次运行 `qa/curate_first500_glosses.py`、`qa/curate_next200_glosses.py --apply`、`qa/curate_next100_glosses.py --apply`；例句的第 501–700 词由 `qa/curate_next200_examples.py --apply` 恢复，第 701–800 词原先缺中文的句子由 `qa/curate_701_800_example_gaps.py --apply` 恢复。原词典释义仍保存在每条词的 `full` 字段。第 501–700 词的可编辑句子分别存于两份 `curated_examples_*.tsv`。
