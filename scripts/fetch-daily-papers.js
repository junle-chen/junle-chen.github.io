const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(
	projectRoot,
	"src",
	"assets",
	"content",
	"data",
	"daily-papers.json"
);

function readExistingDailyPapers() {
	if (!fs.existsSync(outputPath)) {
		return null;
	}
	try {
		return JSON.parse(fs.readFileSync(outputPath, "utf8"));
	} catch (error) {
		return null;
	}
}

function normalizePaperKey(paper) {
	const value = String(paper.id || paper.url || paper.arxiv_url || paper.paper_url || paper.title || "")
		.trim()
		.toLowerCase();
	const arxivMatch = value.match(/(?:arxiv\.org\/abs\/)?(\d{4}\.\d{4,5})(?:v\d+)?/);
	return arxivMatch ? arxivMatch[1] : value;
}

function mergePaperItem(existing, incoming) {
	const merged = {
		...(existing || {}),
		...(incoming || {}),
	};
	const existingHasAnalysis = existing && existing.analysis && !incoming.analysis;
	if (existingHasAnalysis) {
		merged.analysis = existing.analysis;
	}
	if (existing && existing.analysis_error && !incoming.analysis_error) {
		merged.analysis_error = existing.analysis_error;
	}
	merged.recommendation = {
		...((existing && existing.recommendation) || {}),
		...((incoming && incoming.recommendation) || {}),
	};
	merged.brief = existingHasAnalysis
		? {
			...((incoming && incoming.brief) || {}),
			...((existing && existing.brief) || {}),
		}
		: {
			...((existing && existing.brief) || {}),
			...((incoming && incoming.brief) || {}),
		};
	return merged;
}

function mergeDailyPaperItems(freshItems, existingItems) {
	const byKey = new Map();
	const orderedKeys = [];
	function upsert(item, fresh) {
		const key = normalizePaperKey(item);
		if (!key) {
			return;
		}
		if (!byKey.has(key)) {
			orderedKeys.push(key);
			byKey.set(key, item);
			return;
		}
		const current = byKey.get(key);
		byKey.set(key, fresh ? mergePaperItem(current, item) : mergePaperItem(item, current));
	}
	(freshItems || []).forEach((item) => upsert(item, true));
	(existingItems || []).forEach((item) => upsert(item, false));
	return orderedKeys.map((key) => byKey.get(key));
}

const queryTerms = [
	"agentic reinforcement learning",
	"agentic rl",
	"multi-turn agent",
	"multi turn agent",
	"long-horizon planning",
	"long horizon agent",
	"agent planning",
	"planning agent",
	"agent memory",
	"stateful agent",
	"interactive replanning",
	"reinforcement learning agent",
];

const focusText =
	"多轮交互式 agent planning、long-horizon planning、stateful/personalized planning、agent memory、planning reliability、agentic RL";

function requestText(url, redirects = 0) {
	return new Promise((resolve, reject) => {
		const client = url.startsWith("https:") ? https : http;
		client
			.get(url, (response) => {
				if (
					response.statusCode >= 300 &&
					response.statusCode < 400 &&
					response.headers.location &&
					redirects < 3
				) {
					response.resume();
					resolve(
						requestText(
							new URL(response.headers.location, url).toString(),
							redirects + 1
						)
					);
					return;
				}
				if (response.statusCode < 200 || response.statusCode >= 300) {
					reject(new Error(`arXiv returned ${response.statusCode}`));
					response.resume();
					return;
				}
				let body = "";
				response.setEncoding("utf8");
				response.on("data", (chunk) => {
					body += chunk;
				});
				response.on("end", () => resolve(body));
			})
			.on("error", reject);
	});
}

function decodeXml(value) {
	return String(value || "")
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

function tagValue(entry, tag) {
	const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
	return match ? decodeXml(match[1]) : "";
}

function attrValues(entry, tag, attr) {
	const values = [];
	const pattern = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*>`, "gi");
	let match;
	while ((match = pattern.exec(entry))) {
		values.push(decodeXml(match[1]));
	}
	return values;
}

function extractUrl(text, hosts) {
	const hostPattern = hosts.map((host) => host.replace(/\./g, "\\.")).join("|");
	const pattern = new RegExp(`https?:\\/\\/(?:www\\.)?(?:${hostPattern})\\/[^\\s),]+`, "i");
	const match = String(text || "").match(pattern);
	return match ? match[0].replace(/[.;]+$/, "") : "";
}

function extractRepoUrl(paper) {
	return extractUrl([paper.title, paper.summary, paper.url].join(" "), [
		"github.com",
		"gitlab.com",
		"huggingface.co",
	]);
}

function extractProjectUrl(paper) {
	return extractUrl([paper.title, paper.summary, paper.url].join(" "), [
		"github.io",
		"pages.dev",
		"vercel.app",
		"netlify.app",
		"huggingface.co",
	]);
}

function includesAny(text, signals) {
	return signals.some((signal) => text.includes(signal));
}

function firstSentence(text, pattern) {
	const sentences = String(text || "")
		.replace(/\s+/g, " ")
		.split(/(?<=[.!?])\s+/)
		.filter(Boolean);
	return sentences.find((sentence) => pattern.test(sentence)) || "";
}

function truncate(text, maxLength) {
	const value = String(text || "").replace(/\s+/g, " ").trim();
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength - 1).trim()}...`;
}

function getSignals(paper) {
	const text = `${paper.title} ${paper.summary}`.toLowerCase();
	return {
		agenticRl: includesAny(text, [
			"agentic reinforcement learning",
			"agentic rl",
			"reinforcement learning",
			"grpo",
			"ppo",
			"reward",
			"policy optimization",
		]),
		multiTurn: includesAny(text, [
			"multi-turn",
			"multi turn",
			"dialogue",
			"interactive",
			"interaction",
			"replanning",
		]),
		longHorizon: includesAny(text, [
			"long-horizon",
			"long horizon",
			"multi-step",
			"multi step",
			"planning",
			"planner",
			"plan",
		]),
		memory: includesAny(text, [
			"memory",
			"stateful",
			"personalized",
			"preference",
			"forgetting",
			"recall",
		]),
		reliability: includesAny(text, [
			"reliability",
			"robust",
			"failure",
			"benchmark",
			"evaluation",
			"success rate",
			"success-rate",
			"outperform",
		]),
		codeOrTool: includesAny(text, ["code:", "github", "tool", "open-source", "released"]),
		experiments: includesAny(text, [
			"experiments",
			"evaluate",
			"benchmark",
			"outperform",
			"achieves",
			"success rate",
			"validated",
			"ablation",
			"baseline",
		]),
		survey: includesAny(text, ["survey", "review", "position paper", "perspective"]),
	};
}

function recommendationFor(paper) {
	const signals = getSignals(paper);
	let score = 36;
	if (signals.agenticRl) score += 16;
	if (signals.multiTurn) score += 14;
	if (signals.longHorizon) score += 14;
	if (signals.memory) score += 12;
	if (signals.reliability) score += 10;
	if (signals.experiments) score += 10;
	if (signals.codeOrTool || extractRepoUrl(paper)) score += 8;
	if (signals.survey) score -= 8;
	if (!signals.experiments) score -= 8;
	if (!signals.agenticRl && !signals.multiTurn && !signals.longHorizon && !signals.memory) {
		score -= 18;
	}
	score = Math.max(10, Math.min(98, score));

	let label = "暂不优先";
	if (score >= 85) {
		label = "强烈推荐";
	} else if (score >= 70) {
		label = "值得读";
	} else if (score >= 55) {
		label = "可略读";
	}
	const level = score >= 78 ? "高" : score >= 58 ? "中" : "低";

	let waterRisk = "高";
	if (score >= 78 && signals.experiments) {
		waterRisk = "低";
	} else if (score >= 58) {
		waterRisk = "中";
	}

	const reasons = [];
	if (signals.agenticRl) reasons.push("直接覆盖 agentic RL 或 policy optimization");
	if (signals.multiTurn) reasons.push("涉及多轮交互、状态延续或交互式重规划");
	if (signals.longHorizon) reasons.push("和 long-horizon planning / multi-step task 相关");
	if (signals.memory) reasons.push("包含 agent memory、stateful 或 personalized agent 信号");
	if (signals.experiments) reasons.push("摘要给出实验、benchmark 或 baseline 证据");
	if (extractRepoUrl(paper)) reasons.push("摘要中出现公开代码仓库");
	if (!reasons.length) reasons.push("和目标主题只有弱相关，需要正文确认价值");

	const judgement =
		waterRisk === "低"
			? "有价值：优先进入今日精读候选。"
			: waterRisk === "中"
				? "需要谨慎：可能有启发，但先看实验和设定是否扎实。"
				: "可能偏水：主题或实验信号偏弱，除非和当前问题强相关，否则不优先。";

	return {
		score,
		level,
		label,
		water_risk: waterRisk,
		value_judgement: judgement,
		reason: reasons.join("；") + "。",
		signals,
	};
}

function buildBrief(paper) {
	const recommendation = recommendationFor(paper);
	const summary = paper.summary || "";
	const methodSentence = firstSentence(
		summary,
		/\b(propose|introduce|present|framework|method|model|algorithm|tree search|reinforcement|optimization|training|agent)\b/i
	);
	const experimentSentence = firstSentence(
		summary,
		/\b(experiment|benchmark|result|outperform|achieve|demonstrate|evaluate|success|accuracy|score|validated|baseline|ablation)\b/i
	);
	const lower = `${paper.title} ${summary}`.toLowerCase();

	let motivation = "这篇论文的动机是推进更可靠的 agent 训练、规划或执行能力。";
	if (/sparse|long[- ]?horizon|complex|failure|struggle|limited/.test(lower)) {
		motivation = "动机是解决长程 agent 任务中的稀疏反馈、复杂交互、失败恢复或规划可靠性问题。";
	}
	if (/multi[- ]?turn|interactive|dialog/.test(lower)) {
		motivation = "动机集中在多轮交互中如何保持状态、偏好和约束，并减少跨轮规划退化。";
	}
	if (/memory|forgetting|recall/.test(lower)) {
		motivation = "动机集中在 agent memory 的写入、检索、更新或遗忘可靠性。";
	}

	const method =
		methodSentence ||
		"摘要没有给出足够细的方法细节；需要正文确认核心模块、训练流程和 agent 接口。";
	const experiments =
		experimentSentence ||
		"摘要没有明确实验数字；自动化建议先打开正文检查 benchmark、baseline、ablation 和失败案例。";

	let researchHelp = "可作为 Daily Paper 候选，优先检查任务定义、评测协议、失败案例和可复现资源。";
	if (recommendation.signals.agenticRl) {
		researchHelp = "对 agentic RL 有帮助：重点看奖励设计、trajectory 采样、环境反馈和 policy optimization 的接口。";
	}
	if (recommendation.signals.multiTurn) {
		researchHelp = "对多轮 agent 有帮助：重点看状态保持、用户偏好延续、澄清机制和跨轮评测。";
	}
	if (recommendation.signals.longHorizon) {
		researchHelp = "对 long-horizon planning 有帮助：重点看任务分解、搜索/回溯、失败恢复和子目标评估。";
	}
	if (recommendation.signals.memory) {
		researchHelp = "对 agent memory 有帮助：重点看记忆写入、检索、更新和个性化状态如何进入规划过程。";
	}

	return {
		authors: paper.authors || [],
		affiliations: "arXiv metadata 未提供；需要正文或项目页确认单位。",
		date: paper.published || paper.updated || "",
		paper_url: (paper.url || "").replace(/^http:\/\//, "https://"),
		project_url: extractProjectUrl(paper),
		repo_url: extractRepoUrl(paper),
		venue_status: "未确认录用",
		contribution: recommendation.reason,
		summary: truncate(summary, 420),
		highlights: [
			recommendation.value_judgement,
			recommendation.reason,
			recommendation.signals.experiments
				? "摘要包含实验或 benchmark 信号，可以进一步检查结果是否扎实。"
				: "摘要缺少明确实验信号，可能需要降低阅读优先级。",
		],
		motivation,
		method,
		experiments,
		research_help: researchHelp,
		recommendation,
	};
}

function parseEntries(xml, reportDate = "") {
	return xml
		.split("<entry>")
		.slice(1)
		.map((chunk) => chunk.split("</entry>")[0])
		.map((entry) => {
			const authors = [];
			const authorPattern = /<author>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi;
			let authorMatch;
			while ((authorMatch = authorPattern.exec(entry))) {
				authors.push(decodeXml(authorMatch[1]));
			}
			const categories = attrValues(entry, "category", "term");
			const title = tagValue(entry, "title");
			const summary = tagValue(entry, "summary");
			const url = tagValue(entry, "id");
			const paper = {
				id: url.split("/abs/").pop() || url,
				title,
				summary,
				url,
				authors,
				report_date: reportDate,
				published: tagValue(entry, "published").slice(0, 10),
				updated: tagValue(entry, "updated").slice(0, 10),
				primary_category: categories[0] || "",
				categories,
			};
			const brief = buildBrief(paper);
			return {
				...paper,
				project_url: brief.project_url,
				repo_url: brief.repo_url,
				venue_status: brief.venue_status,
				recommendation: brief.recommendation,
				brief,
			};
		});
}

function relevanceScore(item) {
	const recommendation = item.recommendation || recommendationFor(item);
	return recommendation.score;
}

function buildUrl() {
	const searchQuery = queryTerms.map((term) => `all:"${term}"`).join(" OR ");
	const params = new URLSearchParams({
		search_query: searchQuery,
		start: "0",
		max_results: "40",
		sortBy: "submittedDate",
		sortOrder: "descending",
	});
	return `https://export.arxiv.org/api/query?${params.toString()}`;
}

function formatAuthors(authors) {
	if (!Array.isArray(authors) || !authors.length) {
		return "N/A";
	}
	return authors.slice(0, 6).join(", ") + (authors.length > 6 ? " 等" : "");
}

function formatHongKongDate(date) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Hong_Kong",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

function buildDigest(items, updatedAt) {
	const reportDate = formatHongKongDate(new Date(updatedAt));
	const top = items.slice(0, 3);
	const lowPriority = items
		.filter((item) => item.recommendation.water_risk !== "低" || item.recommendation.score < 62)
		.slice(0, 3);
	const summary = items.length
		? `今日自动化从 arXiv 抓取并初筛 ${items.length} 篇候选，重点关注 ${focusText}。相关度为元数据初筛结果，真正价值仍需结合正文确认。`
		: "今日无高相关新增论文。";

	const lines = [
		`${reportDate} Daily Paper`,
		"",
		summary,
		"",
		"最值得读的 3 篇",
		...top.map((paper, index) => {
			const brief = paper.brief || {};
			const recommendation = paper.recommendation || {};
			return [
				`${index + 1}. ${paper.title}`,
				`- 作者：${formatAuthors(paper.authors)}`,
				`- 单位：${brief.affiliations || "待正文确认"}`,
				`- 日期：${paper.published || paper.updated || "N/A"}`,
				`- 论文链接：${(paper.url || "").replace(/^http:\/\//, "https://")}`,
				`- 项目页：${paper.project_url || "未发现"}`,
				`- 代码仓库：${paper.repo_url || "未发现"}`,
				`- 录用：${paper.venue_status || "未确认录用"}`,
				`- 相关度：${recommendation.level || "中"}（原因：${recommendation.reason || recommendation.label || "待评估"}；偏水风险：${recommendation.water_risk || "未知"}）`,
				`- 贡献：${brief.contribution || recommendation.reason || "待确认"}`,
				`- 总结：${brief.summary || truncate(paper.summary, 360)}`,
				`- 亮点：${(brief.highlights || []).join("；")}`,
			].join("\n");
		}),
	];

	if (lowPriority.length) {
		lines.push("", "暂不优先 / 可能偏水");
		lowPriority.forEach((paper) => {
			lines.push(
				`- ${paper.title}：相关度 ${paper.recommendation.level || "中"}，${paper.recommendation.value_judgement}`
			);
		});
	}

	return {
		title: `${reportDate} Daily Paper`,
		report_date: reportDate,
		focus: focusText,
		summary,
		top_recommendations: top.map((paper) => paper.id),
		low_priority: lowPriority.map((paper) => paper.id),
		no_news_policy:
			"如果没有新的高相关论文，自动化应返回“今日无高相关新增论文”，不写邮件正文文件，也不发送邮件。",
		email_body: lines.join("\n"),
	};
}

async function main() {
	const xml = await requestText(buildUrl());
	const updatedAt = new Date().toISOString();
	const reportDate = formatHongKongDate(new Date(updatedAt));
	const freshItems = parseEntries(xml, reportDate)
		.filter((item) => relevanceScore(item) >= 46)
		.sort((a, b) => {
			const dateCompare = String(b.published).localeCompare(String(a.published));
			if (dateCompare !== 0) {
				return dateCompare;
			}
			return relevanceScore(b) - relevanceScore(a);
		})
		.slice(0, 16);
	const existing = readExistingDailyPapers();
	const items = mergeDailyPaperItems(freshItems, existing && existing.items);

	const output = {
		updated_at: updatedAt,
		source: "arxiv",
		analysis_method: "metadata-first Codex automation schema",
		query_focus: focusText,
		query_terms: queryTerms,
		automation_contract: {
			runner: "npm run papers:daily:codex",
			email_title_template: "YYYY-MM-DD Daily Paper",
			fields: [
				"作者",
				"单位",
				"日期",
				"论文链接",
				"项目页",
				"代码仓库",
				"录用",
				"相关度",
				"偏水风险",
				"贡献",
				"总结",
				"亮点",
			],
		},
		digest: buildDigest(freshItems, updatedAt),
		latest_item_ids: freshItems.map((item) => item.id).filter(Boolean),
		archive: {
			policy: "append_or_update_by_arxiv_id",
			fresh_items: freshItems.length,
			total_items: items.length,
			previous_items: existing && Array.isArray(existing.items) ? existing.items.length : 0,
		},
		items,
	};

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
	console.log(
		`Wrote ${freshItems.length} fresh papers and preserved ${items.length} total papers in ${path.relative(
			projectRoot,
			outputPath
		)}`
	);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
