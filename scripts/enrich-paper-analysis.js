const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "src", "assets", "content", "data");
const dailyPath = path.join(dataDir, "daily-papers.json");
const zoteroPath = path.join(dataDir, "zotero-paper-list.json");

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
	fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function compact(text, maxLength = 240) {
	const value = String(text || "").replace(/\s+/g, " ").trim();
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength - 1).trim()}...`;
}

function hasCjk(text) {
	return /[\u3400-\u9fff]/.test(String(text || ""));
}

function preferChinese(primary, fallback) {
	return hasCjk(primary) ? compact(primary) : fallback;
}

function hasAny(text, terms) {
	return terms.some((term) => text.includes(term));
}

function hasSignal(text, signals) {
	return signals.some((signal) => {
		if (signal instanceof RegExp) {
			return signal.test(text);
		}
		return text.includes(signal);
	});
}

function hasRlSignal(text) {
	return hasSignal(text, [
		/\breinforcement learning\b/i,
		/\bpolicy optimization\b/i,
		/\breward\b/i,
		/\bgrpo\b/i,
		/\bppo\b/i,
		/\bagentic rl\b/i,
	]);
}

function extractSignals(text) {
	const source = String(text || "");
	const benchmarks = [
		"ALFWorld",
		"WebShop",
		"ScienceWorld",
		"Bench2Drive",
		"NAVSIM",
		"nuScenes",
		"SWE-bench",
		"GAIA",
		"TravelPlanner",
		"Mind2Web",
		"OSWorld",
	].filter((name) => source.includes(name));
	const metrics = source.match(/\b\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?x\b/gi) || [];
	return Array.from(new Set([...benchmarks, ...metrics])).slice(0, 5);
}

function inferMotivation(source) {
	if (hasAny(source, ["skill tree", "skill search", "tool use", "tool-use", "openclaw"])) {
		return "动机是让 agent 能复用、筛选和迁移技能，减少复杂任务里临场规划和工具调用的不稳定。";
	}
	if (hasRlSignal(source) || hasAny(source, ["sparse feedback", "credit assignment"])) {
		return "动机是缓解长程 agent 训练里的稀疏反馈和 credit assignment 问题，让环境交互能转化为更稳定的策略学习信号。";
	}
	if (hasAny(source, ["multi-turn", "multi turn", "interactive", "dialogue", "clarification"])) {
		return "动机是处理多轮交互中的状态延续、澄清、偏好变化和跨轮一致性。";
	}
	if (hasAny(source, ["long-horizon", "long horizon", "multi-step", "planning", "planner"])) {
		return "动机是提升 LLM agent 在长程、多步骤任务中的规划可靠性和失败恢复能力。";
	}
	if (hasAny(source, ["memory", "stateful", "personalized", "preference"])) {
		return "动机是让 agent 能更可靠地写入、更新和使用长期记忆或个性化状态。";
	}
	if (hasAny(source, ["benchmark", "evaluation", "dataset", "metric"])) {
		return "动机是补足 agent planning / agent memory 的评测缺口，让不同方法可以在同一任务与指标下比较。";
	}
	return "动机是改进 LLM agent 在复杂任务中的规划、执行或可靠性表现，需要结合正文确认具体问题设定。";
}

function inferMethod(rawSource) {
	const source = rawSource.toLowerCase();
	const lead = source.slice(0, 220);
	if (/\b(benchmark|bench|evaluating|diagnosing)\b/.test(lead) || hasAny(lead, ["orchestrationbench", "drift-bench"])) {
		return "方法核心是构建任务集、指标或评测协议，用统一 benchmark 暴露 agent 的规划、记忆或执行失败。";
	}
	if (hasAny(source, ["code-as-policies", "repositories-as-policies", "robotics harness", "roboticist"])) {
		return "方法核心是让代码型 agent 搜索可解释的策略仓库，把感知、规划和控制原语组合成可执行 policy。";
	}
	if (hasAny(source, ["skill tree", "skill search", "collective skill", "tool use", "tool-use", "openclaw"])) {
		return "方法核心是构建可搜索的技能树，并用多模型或多轮评估筛选可迁移技能，服务复杂工具调用任务。";
	}
	if (hasAny(source, ["tensor", "decomposition", "coordination", "conflict-free"])) {
		return "方法核心是用代数分解或结构化表示建模多 agent 联合计划，定位冲突并约束协同执行。";
	}
	if (hasRlSignal(source)) {
		return "方法核心是把环境轨迹、奖励信号和 policy optimization 接起来，让 agent 在多步交互中学习更稳定的策略。";
	}
	if (hasAny(source, ["multi-turn", "multi turn", "interactive", "dialogue", "clarification"])) {
		return "方法核心是围绕多轮轨迹维护状态与约束，并用交互反馈修正下一步规划。";
	}
	if (hasAny(source, ["memory", "stateful", "personalized", "preference"])) {
		return "方法核心是把记忆写入、检索、更新或遗忘纳入 agent 控制流程，减少跨任务状态漂移。";
	}
	if (hasAny(source, ["long-horizon", "long horizon", "multi-step", "planning", "planner", "search"])) {
		return "方法核心是把复杂任务拆成可执行的子目标，结合搜索、重规划或约束检查提升长程规划稳定性。";
	}
	if (hasAny(source, ["benchmark", "evaluation", "dataset", "metric"])) {
		return "方法核心是构建任务集、指标或评测协议，用统一 benchmark 暴露 agent 的规划、记忆或执行失败。";
	}
	return "方法需要结合正文细读；从元数据看，重点应落在 agent 训练、规划模块、工具调用或评测框架上。";
}

function inferExperiments(rawSource) {
	const source = rawSource.toLowerCase();
	const signals = extractSignals(rawSource);
	const suffix = signals.length ? `，可见信号包括 ${signals.join("、")}` : "";
	if (hasAny(source, ["experiment", "evaluate", "benchmark", "result", "outperform", "achieve", "success", "baseline", "ablation", "validated", "demonstrate"])) {
		return `摘要显示包含实验或 benchmark 对比${suffix}；精读时应检查 baseline、ablation、失败案例和统计口径。`;
	}
	return `元数据未给出明确实验结果${suffix}；需要打开正文确认任务设置、baseline 和可复现资源。`;
}

function inferResearchHelp(source, fallback) {
	if (hasAny(source, ["benchmark", "evaluation", "dataset", "metric"])) {
		return "可作为评测基线或任务设计参考，优先检查任务覆盖、指标定义、失败案例和可复现性。";
	}
	if (hasRlSignal(source)) {
		return "对 agentic RL 有帮助，重点看奖励设计、trajectory 采样、环境反馈和 policy optimization 接口。";
	}
	if (hasAny(source, ["long-horizon", "long horizon", "multi-step", "planning", "planner"])) {
		return "对 long-horizon planning 有帮助，重点看任务分解、搜索/回溯、失败恢复和子目标评估。";
	}
	if (hasAny(source, ["multi-turn", "multi turn", "interactive", "dialogue", "clarification"])) {
		return "对多轮 agent 有帮助，重点看状态保持、用户偏好延续、澄清机制和跨轮评测。";
	}
	if (hasAny(source, ["memory", "stateful", "personalized", "preference"])) {
		return "对 agent memory / personalization 有帮助，重点看记忆写入、检索、更新和状态如何进入规划。";
	}
	return fallback || "适合作为 Planning 文献池候选，优先检查问题设定是否能服务当前 research。";
}

function analyzePaper({ title, abstract, summary, reason, collections }) {
	const rawSource = [title, abstract, summary, ...(collections || [])].join(" ");
	const source = rawSource.toLowerCase();
	const researchSource = [rawSource, reason].join(" ").toLowerCase();
	return {
		motivation: inferMotivation(source),
		method: inferMethod(rawSource),
		experiments: inferExperiments(rawSource),
		research_help: inferResearchHelp(researchSource),
	};
}

function enrichDaily() {
	const data = readJson(dailyPath);
	data.analysis_method = "Codex GPT static reading from arXiv metadata, abstracts, and automation brief fields";
	data.items = (data.items || []).map((paper) => {
		const brief = paper.brief || {};
		const inferred = analyzePaper({
			title: paper.title,
			abstract: paper.summary,
			summary: brief.summary,
			reason: brief.contribution,
			collections: paper.categories,
		});
		return {
			...paper,
			analysis: {
				motivation: preferChinese(brief.motivation, inferred.motivation),
				method: preferChinese(brief.method, inferred.method),
				experiments: preferChinese(brief.experiments, inferred.experiments),
				research_help: preferChinese(brief.research_help, inferred.research_help),
			},
		};
	});
	writeJson(dailyPath, data);
	console.log(`Enriched ${data.items.length} Daily Paper items`);
}

function enrichZotero() {
	const data = readJson(zoteroPath);
	data.analysis_method = "Codex GPT static reading from Zotero Planning metadata and abstracts";
	data.items = (data.items || []).map((paper) => {
		const analysis = analyzePaper({
			title: paper.title,
			abstract: paper.abstract,
			summary: paper.summary,
			reason: paper.reason,
			collections: paper.collections,
		});
		return {
			...paper,
			affiliations:
				paper.affiliations ||
				"Zotero metadata 未提供；需打开论文正文或 arXiv 页面确认作者单位。",
			analysis,
		};
	});
	writeJson(zoteroPath, data);
	console.log(`Enriched ${data.items.length} Zotero Paper List items`);
}

enrichDaily();
enrichZotero();
