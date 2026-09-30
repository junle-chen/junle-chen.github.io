const fs = require("fs");
const http = require("http");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(
	projectRoot,
	"src",
	"assets",
	"content",
	"data",
	"zotero-paper-list.json"
);

const baseUrl = process.env.ZOTERO_LOCAL_API || "http://127.0.0.1:23119/api/users/0";

const planningCollections = [
	{ key: "P58U5SGR", name: "Benchmarks & Evaluation", short: "Benchmark" },
	{ key: "LB5PYX4E", name: "Travel Planning Agents & Systems", short: "Travel" },
	{ key: "WY5Z84Q8", name: "Personalization & User Modeling", short: "Personalization" },
	{ key: "VUF6JWWA", name: "Long-Horizon Planning Methods", short: "Long-horizon" },
	{ key: "8XP65M5K", name: "Constraints, Verification & Solver Methods", short: "Constraints" },
	{ key: "DGUY7Y9Z", name: "Multi-Agent, Collaboration & Backtracking", short: "Multi-agent" },
	{ key: "8RP7GNLZ", name: "Multi-turn", short: "Multi-turn" },
];

function requestJson(url) {
	return new Promise((resolve, reject) => {
		http
			.get(url, (response) => {
				if (response.statusCode < 200 || response.statusCode >= 300) {
					reject(new Error(`Zotero local API returned ${response.statusCode}`));
					response.resume();
					return;
				}
				let body = "";
				response.setEncoding("utf8");
				response.on("data", (chunk) => {
					body += chunk;
				});
				response.on("end", () => {
					try {
						resolve(JSON.parse(body));
					} catch (error) {
						reject(error);
					}
				});
			})
			.on("error", reject);
	});
}

function normalizeTitle(title) {
	return String(title || "")
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function compact(text, maxLength) {
	const value = String(text || "").replace(/\s+/g, " ").trim();
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength - 1).trim()}...`;
}

function yearFrom(data) {
	const source = data.date || data.publicationTitle || data.dateAdded || "";
	const match = String(source).match(/\b(20\d{2}|19\d{2})\b/);
	return match ? match[1] : "";
}

function creatorsFrom(data) {
	return (data.creators || [])
		.map((creator) =>
			[creator.firstName, creator.lastName].filter(Boolean).join(" ").trim()
		)
		.filter(Boolean);
}

function extractUrl(text, hosts) {
	const hostPattern = hosts.map((host) => host.replace(/\./g, "\\.")).join("|");
	const pattern = new RegExp(`https?:\\/\\/(?:www\\.)?(?:${hostPattern})\\/[^\\s),]+`, "i");
	const match = String(text || "").match(pattern);
	return match ? match[0].replace(/[.;]+$/, "") : "";
}

function repoUrlFor(data) {
	return extractUrl([data.url, data.extra, data.abstractNote, data.title].join(" "), [
		"github.com",
		"gitlab.com",
		"huggingface.co",
	]);
}

function publicUrlFor(data) {
	if (data.url) {
		return data.url.replace(/^http:\/\//, "https://");
	}
	if (data.DOI) {
		return `https://doi.org/${data.DOI}`;
	}
	return "";
}

function hasAny(text, signals) {
	return signals.some((signal) => text.indexOf(signal) !== -1);
}

function analyzePaper(data, collectionNames) {
	const text = [data.title, data.abstractNote, data.extra, collectionNames.join(" ")]
		.join(" ")
		.toLowerCase();
	const reasons = [];
	let score = 0;

	if (hasAny(text, ["long-horizon", "long horizon", "multi-step", "planning", "planner"])) {
		score += 18;
		reasons.push("覆盖长程规划或多步任务");
	}
	if (hasAny(text, ["multi-turn", "multi turn", "dialogue", "interactive", "clarification"])) {
		score += 16;
		reasons.push("涉及多轮交互或澄清");
	}
	if (hasAny(text, ["benchmark", "evaluation", "dataset", "success rate", "metric"])) {
		score += 14;
		reasons.push("可用于评测或基准对比");
	}
	if (hasAny(text, ["constraint", "verification", "solver", "backtracking", "replan"])) {
		score += 14;
		reasons.push("强调约束、验证或回溯");
	}
	if (hasAny(text, ["personalization", "personalized", "preference", "memory", "stateful"])) {
		score += 12;
		reasons.push("和偏好、记忆或状态保持相关");
	}
	if (hasAny(text, ["agent", "llm", "tool", "environment", "travel"])) {
		score += 10;
		reasons.push("贴近 agent planning 工作流");
	}
	if (repoUrlFor(data)) {
		score += 8;
		reasons.push("有公开仓库信号");
	}
	if (!data.abstractNote) {
		score -= 8;
	}

	const level = score >= 42 ? "高" : score >= 24 ? "中" : "低";
	if (!reasons.length) {
		reasons.push("元数据相关性较弱，需要正文确认");
	}

	let summary = "适合作为 agent planning 文献池候选，重点检查任务定义、约束设定、评测协议和失败模式。";
	if (collectionNames.some((name) => /Benchmark|Evaluation/i.test(name))) {
		summary = "适合作为评测基线或 benchmark 入口，重点看任务覆盖、指标设计和失败案例。";
	} else if (collectionNames.some((name) => /Long-Horizon/i.test(name))) {
		summary = "适合跟踪长程任务分解、跨步骤状态保持、失败恢复和子目标评估。";
	} else if (collectionNames.some((name) => /Multi-turn/i.test(name))) {
		summary = "适合跟踪跨轮状态、澄清、偏好延续和交互式重规划。";
	} else if (collectionNames.some((name) => /Travel/i.test(name))) {
		summary = "适合连接真实旅行规划中的时间、空间、偏好和工具调用约束。";
	} else if (collectionNames.some((name) => /Personalization/i.test(name))) {
		summary = "适合研究用户偏好建模、长期上下文和个性化规划。";
	} else if (collectionNames.some((name) => /Constraints/i.test(name))) {
		summary = "适合研究约束建模、可验证规划和 LLM 与 solver 的结合。";
	} else if (collectionNames.some((name) => /Multi-Agent/i.test(name))) {
		summary = "适合研究多 agent 协作、冲突消解、回溯和任务分工。";
	}

	return {
		level,
		reason: reasons.slice(0, 4).join("；") + "。",
		summary,
	};
}

async function fetchCollectionItems(collection) {
	const url = `${baseUrl}/collections/${collection.key}/items?include=data&limit=100`;
	const items = await requestJson(url);
	return items
		.map((item) => item.data || item)
		.filter((data) => data && data.title && !/^(attachment|note)$/i.test(data.itemType || ""));
}

async function main() {
	const byTitle = new Map();
	const groups = [];

	for (const collection of planningCollections) {
		const items = await fetchCollectionItems(collection);
		groups.push({ ...collection, count: items.length });
		for (const data of items) {
			const key = normalizeTitle(data.title);
			if (!key) {
				continue;
			}
			const existing = byTitle.get(key);
			if (existing) {
				if (!existing.collections.includes(collection.name)) {
					existing.collections.push(collection.name);
				}
				if (!existing.collection_shorts.includes(collection.short)) {
					existing.collection_shorts.push(collection.short);
				}
				continue;
			}
			const collections = [collection.name];
			const analysis = analyzePaper(data, collections);
			byTitle.set(key, {
				zotero_key: data.key,
				title: data.title,
				year: yearFrom(data),
				authors: creatorsFrom(data),
				publication: data.publicationTitle || data.conferenceName || "",
				url: publicUrlFor(data),
				repo_url: repoUrlFor(data),
				collections,
				collection_shorts: [collection.short],
				level: analysis.level,
				reason: analysis.reason,
				summary: analysis.summary,
				abstract: compact(data.abstractNote, 520),
			});
		}
	}

	const items = Array.from(byTitle.values()).map((item) => {
		const analysis = analyzePaper(
			{
				title: item.title,
				abstractNote: item.abstract,
				url: item.url,
				extra: "",
			},
			item.collections
		);
		return {
			...item,
			level: analysis.level,
			reason: analysis.reason,
			summary: analysis.summary,
		};
	});

	const output = {
		updated_at: new Date().toISOString(),
		source: "zotero-local-planning",
		collection_key: "IH3NISJ6",
		analysis_method: "Codex static analysis from Zotero metadata",
		groups,
		items,
	};

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
	console.log(`Wrote ${items.length} Zotero Planning papers to ${path.relative(projectRoot, outputPath)}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
