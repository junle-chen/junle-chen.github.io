### 封闭式评估与基准测试
- 许多 NLP 任务是“封闭式”的，这意味着潜在答案数量有限1，通常只有一个或少数几个正确答案。
- 例子包括：情感分类（例如情感标签）和抽取式问答（文档中包含答案的部分）。
- 封闭式任务的特点是便于自动评估，这与通常的机器学习评估方法相似。
- **单任务基准测试**专注于评估模型在特定任务上的表现：情感分析：SST, IMDB；蕴涵关系判断 (Entailment)：SNLI, MultiNLI;问答 (QA)：SQuAD, NaturalQuestions;
- **多任务基准测试**则试图衡量模型的“通用语言能力”:SuperGLUE 是一个多任务基准测试2，包含多种不同的任务2，例如：阅读理解 (reading texts)：BoolQ, MultiRC2；蕴涵关系判断 (Entailment)：CB, RTE2；因果关系 (cause and effect)：COPA3；问答与推理 (QA+reasoning)：ReCoRD3；词义判断 (meaning of words)：WiC3；共指消解 (coreference)：WSC3

MMLU (Massive Multitask Language Understanding) 是一个新的基准测试，用于衡量语言模型在 57 个不同知识密集型任务上的性能3。资料中提供了一些 MMLU 的例子来帮助理解。

一个好的基准测试应具备以下特点：

- 样本选择 (Example selection)：需要有足够的规模和多样性，覆盖感兴趣的现象。复杂的现象需要更多的样本。

- 难度 (Difficulty)：对于人类来说是可行的 (Doable for humans)3，但对于当时的基线模型来说具有挑战性 (Hard for baselines at the time)。

- 标注质量 (Annotation quality)：“正确”的行为应该是明确的 (‘Correct’ behavior should be clear)。



### 基准测试的挑战与进阶评估方法：

- 即使是成功的基准测试（如 SQuAD），也可能存在不足。例如，虽然 SQuAD 规模大、与人类性能差距大、易于自动评估，但数据集本身可能存在未被发现的虚假关联 (undiscovered spurious correlations)
- 资料中通过一个例子说明了“否定偏见” (negation bias) 问题。这类问题表明，简单的基准测试可能会遗漏一些问题

  
虚假关联（Spurious correlations）是指模型在处理基准测试数据集时，可能会利用数据中存在的潜在的、不相关的统计模式或捷径，而不是真正学习任务本身。这意味着模型可能只是在“适应数据集”（fitting the dataset），而不是“学习任务”（learning the task）。当数据集存在未被发现的虚假关联时，即使模型在原始测试集上准确率很高，它也可能在其他“合理”的、分布不同的例子上表现不佳。为了发现这些问题，需要进行更有针对性的（targeted）和对抗性的（adversarial）评估。

否定偏见（Negation bias）在资料中被提及为平面基准测试可能遗漏的一种特定问题。资料中举例说明了在蕴含（Entailment）任务中，数据集可能存在与否定相关的虚假关联。例如，在资料提供的例子中，前提是“The economy could be still better.”（经济可能仍然更好。），假设是“The economy has been never better”（经济从未更好。），这里的关系是蕴含（Entailment）。这种例子可能导致模型学习到，仅仅因为假设中包含“never”（否定词），就预测其与前提之间存在某种特定关系（如蕴含）。模型可能因此利用否定词作为一种简单的启发式方法或捷径来判断蕴含关系，而不是理解句子的完整语义。“否定偏见”问题表明，模型可以通过利用这种虚假关联来获得高准确率。针对这种问题，需要设计能够测试模型在输入特定部分（如否定词）改变时表现如何的评估方法，或是在模型无法利用这些虚假特征的情况下进行评估。

### 评估
因此，需要更针对性评估 (Targeted evaluations) 和对抗性评估 (Adversarial evaluations)。


针对性评估：通过修改输入的特定部分来测试模型能力。


对抗性评估：评估模型在无法利用虚假特征 (spurious features) 的情况下的表现。

诊断性测试集 (Diagnostic test set) 的目的是通过精心构建的测试集来测试模型的特定技能或能力 (specific skill or capacity)，例如，HANS (Heuristic Analysis for NLI Systems) 被设计用来测试 NLI 系统中的句法启发式 (syntactic heuristics)。资料中提到，McCoy et al., 2019 使用 HANS 评估了 4 个 MNLI 模型。结果显示，这些模型在原始测试集 (in-domain) 上准确率很高6，但在 HANS 测试集上，当句法启发式有效时，准确率很高，而当句法启发式失效时，准确率非常非常低。


资料将这些仔细构建的小型测试集比作神经网络的单元测试套件 (unit test suites)，称为 CheckListing。这些最小功能测试 (Minimum functionality tests)旨在针对模型的特定行为。有研究表明，通过这种方法，工程师能够发现模型中的许多错误类别 (categories of high error)。

这些例子表明，在许多任务上，模型在原始测试集上取得高准确率，并不意味着模型在其他“合理”的域外例子 (out-of-domain examples) 上也能表现良好。可以认为，模型似乎是在学习数据集而不是真正地学习任务。


资料中还提到了其他的对抗性或多目标基准测试，例如 Adversarial NLI (ANLI) 和 DynaBench。

开放式文本生成的评估

- 开放式文本生成任务的答案数量是庞大的，“从‘少数正确答案’到‘数千个正确答案’”。

- 这使得人工标注者无法列出所有可能的正确答案。因此，答案之间存在优劣之分，而不仅仅是简单的对错。

- 开放式文本生成的主要评估方法包括：人工评估 (Human Evaluations)、内容重叠度量 (Content Overlap Metrics) 和 基于模型的度量 (Model-based Metrics)。


### 评估方法的具体类型：

- 内容重叠度量 (Content overlap metrics)：

- 计算生成文本与黄金标准（人工编写）参考文本之间的词汇相似度得分9。

- 这种方法快速、高效且广泛使用。


常见的有 N-gram 重叠度量，例如 BLEU, ROUGE, METEOR, CIDEr 等。


- 局限性 (Limitations)：这些度量对于机器翻译来说并非理想，对于比机器翻译更开放的任务（如摘要、对话、故事生成）来说，表现会越来越差。文本越长，越难以衡量。更重要的是，N-gram 重叠度量没有语义关联的概念 (no concept of semantic relatedness)...。资料中提供了一个简单的失败案例，展示了语义上相似但词汇不同的句子得分很低 (False negative)，而词汇相似但语义完全相反的句子得分却很高 (False positive)。


**语义重叠度量** (Semantic overlap metrics)：

- SPICE (Semantic propositional image caption evaluation) 是一个用于图像字幕评估的指标，它首先解析参考文本以生成一个抽象的场景图表示。

- SPIDER 结合了 SPICE 的语义图相似性和 CIDEr 的 N-gram 相似性，以提供更完整的质量评估。


PYRAMID 用于摘要评估，它考虑了人类内容选择的变异性 (human content selection variation)12，通过识别摘要内容单元 (Summarization Content Units, SCUs) 来比较摘要中的信息内容。

### 基于模型的度量 (Model-based metrics)：

这类方法使用词汇或句子的学习表示 (learned representations) 来计算生成文本和参考文本之间的语义相似度，它们通过将文本单元表示为词嵌入 (embeddings)，克服了 N-gram 方法的瓶颈。这些词嵌入通常是预训练的，然后使用距离度量来衡量相似性。


- 例子包括：Word Mover’s Distance (使用词嵌入相似性匹配计算序列距离)、Vector Similarity (基于词嵌入的语义距离，包括 Embedding Average, Vector Extrema, MEANT, YISI 等方法)、BERTSCORE (使用 BERT 的预训练上下文词嵌入，通过余弦相似度匹配词汇)。


- 更进一步的例子包括：BLEURT (一个基于 BERT 的回归模型，评估候选文本的语法和语义与参考文本的一致程度)、Sentence Movers Similarity (基于 Word Movers Distance，使用 RNN 句子嵌入在连续空间中评估文本)、MAUVE (计算生成文本和参考文本在量化嵌入空间中的信息散度)。

- 一个重要的失败案例 (An important failure case)：基于参考的度量取决于其参考文本的质量15。资料指出，CNN/Daily Mail 数据集中的参考文本与人类评估的相关性很差15。不要盲目信任数据集中的参考文本！15 甚至有研究表明，在这些不可靠的参考文本上进行训练反而会使模型变差15。

无参考评估 (Reference free evals)：

这种评估方法由模型给出得分，无需人工参考文本。过去是非标准的，但现在随着 GPT-4 等模型变得流行起来。例子包括：FactCC, GPT-4-as-judge, AlpacaEval16。

潜在问题 (Pitfalls)：与之前的评估方法一样，它们仍然可能存在虚假关联 (Spurious correlations)16...，例如长度偏见 (Length bias)17。对于某些任务，与人类评估的相关性可能低于内容重叠度量16。


人工评估 (Human evaluations)：

- 资料认为，自动化指标在匹配人类判断方面存在不足，因此人工评估是文本生成系统的最重要评估形式 (most important form of evaluation)。

### 评估范式的开放性问题和威胁

评估范式面临一些开放性问题和威胁：

- 一致性 (Consistency)：易于评估的格式（如多选）的结果可能与更有用的格式（如自由文本）的结果不一致...。提示词敏感性 (prompt sensitivity) 和不一致性 (inconsistency) 也是严重的问5...。资料指出，多种形式的一致性（如提示词重写、选项重排）都是严重问题。

- 污染 (Contamination)：训练数据可能包含基准测试集...。对于预训练模型，很难知道基准测试集是否真正是“新”的 (truly ‘new’)。存在一些方法尝试检测污染，例如通过检查模型预测概率是否“过高” (Min-k-prob)或寻找只有通过“偷看”数据集才能学到的特定签名信息 (Exchangeability test)...。然而，这些方法通常是启发式的 (heuristic)，并且目前没有可靠的检测方法适用于文本只出现一次的情况 (no detection method currently reliably works when texts appear only once)。

### 总结与建议

-封闭式任务 (Closed ended tasks) 的评估：需要思考评估的内容（例如多样性、难度） 和外部效度 (external validity)。

- 开放式任务 (Open ended tasks) 的评估：

- 内容重叠度量 (Content overlap metrics)：适用于多样性较低的场景。

- 无参考度量 (Reference free measures)：正在改进，但仍然比较棘手 (still tricky)。

- 聊天机器人评估 (Chatbot evals)：非常困难 (very difficult)。选择合适的例子和评估方法仍然是开放问题。

评估的挑战 (Challenges)：

- 一致性 (Consistency)：难以确定我们是否正在评估正确的方面。
- 污染 (Contamination)：我们是否可以信任评估数字。
