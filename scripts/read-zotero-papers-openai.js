const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const dataPath = path.join(projectRoot, "src", "assets", "content", "data", "zotero-paper-list.json");
const extractorPath = path.join(__dirname, "extract-pdf-text.py");
const bundledPython = "/Users/junle/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const zoteroBaseUrl = process.env.ZOTERO_LOCAL_API || "http://127.0.0.1:23119/api/users/0";

const schema = {
	type: "object",
	additionalProperties: false,
	required: [
		"motivation",
		"method",
		"experiments",
		"research_help",
		"abstract_zh",
		"card_summary",
		"full_summary",
		"recommendation_level",
		"water_risk",
		"value_label",
		"value_reason",
		"limitations",
		"source_evidence",
	],
	properties: {
		motivation: { type: "string" },
		method: { type: "string" },
		experiments: { type: "string" },
		research_help: { type: "string" },
		abstract_zh: { type: "string" },
		card_summary: { type: "string" },
		full_summary: { type: "string" },
		recommendation_level: { type: "string", enum: ["高", "中", "低"] },
		water_risk: { type: "string", enum: ["低", "中", "高"] },
		value_label: { type: "string" },
		value_reason: { type: "string" },
		limitations: { type: "string" },
		source_evidence: {
			type: "array",
			items: { type: "string" },
			minItems: 1,
			maxItems: 4,
		},
	},
};

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
	fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function compact(text, maxLength) {
	const value = String(text || "").replace(/\s+/g, " ").trim();
	return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}...`;
}

function commandPath(command) {
	try {
		return execFileSync("/bin/zsh", ["-lc", `command -v ${command}`], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch (error) {
		return "";
	}
}

function getPythonPath() {
	if (process.env.CODEX_PDF_PYTHON) {
		return process.env.CODEX_PDF_PYTHON;
	}
	return fs.existsSync(bundledPython) ? bundledPython : commandPath("python3");
}

function safeName(value) {
	return String(value || "paper")
		.replace(/[^a-z0-9._-]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 96);
}

function normalizeUrl(url) {
	return String(url || "").replace(/^http:\/\//, "https://").trim();
}

function arxivUrlFrom(value) {
	const match = normalizeUrl(value).match(/arxiv\.org\/(?:abs|pdf)\/([^?#.]+(?:\.\d+)?)/i);
	return match ? `https://arxiv.org/abs/${match[1]}` : "";
}

function arxivPdfUrl(url) {
	const arxivUrl = arxivUrlFrom(url);
	const match = arxivUrl.match(/arxiv\.org\/abs\/([^?#]+)/i);
	return match ? `https://arxiv.org/pdf/${match[1]}.pdf` : "";
}

function aclPdfUrl(url) {
	const normalized = normalizeUrl(url).replace(/\/$/, "");
	return /aclanthology\.org\/\d{4}\.[^/]+/i.test(normalized) ? `${normalized}.pdf` : "";
}

function requestJson(url) {
	return new Promise((resolve, reject) => {
		http
			.get(url, (response) => {
				if (response.statusCode < 200 || response.statusCode >= 300) {
					response.resume();
					reject(new Error(`Zotero local API returned ${response.statusCode}`));
					return;
				}
				let body = "";
				response.setEncoding("utf8");
				response.on("data", (chunk) => { body += chunk; });
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

async function zoteroChildren(key) {
	if (!key) {
		return [];
	}
	try {
		const children = await requestJson(`${zoteroBaseUrl}/items/${key}/children?include=data`);
		return Array.isArray(children) ? children.map((item) => item.data || item) : [];
	} catch (error) {
		return [];
	}
}

function localPdfFromAttachment(attachment) {
	if (!attachment || attachment.itemType !== "attachment") {
		return "";
	}
	if (/pdf/i.test([attachment.contentType, attachment.title, attachment.filename, attachment.path].join(" "))) {
		const localPath = String(attachment.path || "");
		return localPath.startsWith("/") && fs.existsSync(localPath) ? localPath : "";
	}
	return "";
}

function pdfUrlsFor(paper, attachments) {
	const urls = [];
	const add = (url) => {
		const value = normalizeUrl(url);
		if (value && urls.indexOf(value) === -1) {
			urls.push(value);
		}
	};
	attachments.forEach((item) => {
		if (item.itemType === "attachment" && /pdf/i.test([item.contentType, item.title, item.url].join(" "))) {
			add(item.url);
		}
	});
	add(arxivPdfUrl(paper.arxiv_url || paper.url));
	if (/\.pdf(?:$|[?#])/i.test(paper.url || "")) {
		add(paper.url);
	}
	add(aclPdfUrl(paper.url));
	return urls;
}

async function downloadPdf(url, cacheDir, name) {
	if (!url) {
		return "";
	}
	const pdfPath = path.join(cacheDir, `${safeName(name)}.pdf`);
	if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 4096) {
		return pdfPath;
	}
	const response = await fetch(url, { headers: { "User-Agent": "junle-homepage-paper-list/1.0" } });
	if (!response.ok) {
		throw new Error(`PDF download failed ${response.status}: ${url}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length < 4096) {
		throw new Error(`PDF response too small: ${url}`);
	}
	fs.writeFileSync(pdfPath, buffer);
	return pdfPath;
}

function extractTextWithPdftotext(pdfPath) {
	const pdftotext = process.env.PDFTOTEXT_PATH || commandPath("pdftotext");
	if (!pdftotext) {
		return "";
	}
	try {
		return execFileSync(pdftotext, ["-layout", pdfPath, "-"], {
			encoding: "utf8",
			maxBuffer: 32 * 1024 * 1024,
			timeout: 90000,
		});
	} catch (error) {
		return "";
	}
}

function extractTextWithPython(pdfPath) {
	const python = getPythonPath();
	if (!python || !fs.existsSync(extractorPath)) {
		return "";
	}
	try {
		return execFileSync(python, [extractorPath, pdfPath], {
			encoding: "utf8",
			maxBuffer: 32 * 1024 * 1024,
			timeout: 120000,
		});
	} catch (error) {
		return "";
	}
}

function extractPdfText(pdfPath) {
	return [extractTextWithPdftotext(pdfPath), extractTextWithPython(pdfPath)]
		.find((text) => compact(text, 200000).length > 1600) || "";
}

async function getPaperSource(paper, cacheDir) {
	const attachments = await zoteroChildren(paper.zotero_key);
	const arxivUrl =
		arxivUrlFrom(paper.arxiv_url) ||
		arxivUrlFrom(paper.url) ||
		arxivUrlFrom(attachments.map((item) => item.url).join(" "));
	const localAttachment = attachments.find((item) => localPdfFromAttachment(item));
	const localPdf = localAttachment ? localPdfFromAttachment(localAttachment) : "";
	const candidates = [];
	if (localPdf) {
		candidates.push({
			pdfPath: localPdf,
			sourceUrl: arxivUrl || normalizeUrl(localAttachment.url) || normalizeUrl(paper.url),
			note: "Zotero local PDF attachment.",
		});
	}
	for (const url of pdfUrlsFor({ ...paper, arxiv_url: arxivUrl }, attachments)) {
		candidates.push({ pdfUrl: url, sourceUrl: arxivUrl || normalizeUrl(paper.url) || url, note: "Downloaded public PDF." });
	}
	for (const candidate of candidates) {
		try {
			const pdfPath = candidate.pdfPath || await downloadPdf(candidate.pdfUrl, cacheDir, `${paper.zotero_key}-${paper.title}`);
			const text = extractPdfText(pdfPath);
			if (text) {
				return {
					scope: "full_text",
					text,
					pdfPath,
					arxivUrl,
					sourceUrl: candidate.sourceUrl,
					note: candidate.note,
				};
			}
		} catch (error) {
			// Try the next source.
		}
	}
	return {
		scope: "unavailable",
		text: "",
		arxivUrl,
		sourceUrl: normalizeUrl(paper.url),
		note: "No readable PDF source was found; not analyzed from metadata.",
	};
}

function buildPrompt(paper, source) {
	const maxChars = Number(process.env.OPENAI_PAPER_TEXT_CHARS || 52000);
	const payload = {
		zotero_key: paper.zotero_key,
		title: paper.title,
		authors: paper.authors || [],
		year: paper.year || "",
		publication: paper.publication || "",
		collections: paper.collections || [],
		arxiv_url: source.arxivUrl,
		paper_url: source.sourceUrl,
		source_note: source.note,
		source_text: compact(source.text, maxChars),
	};
	return [
		"请基于提供的论文正文，给个人主页 Paper List 生成中文阅读详情。",
		"不要根据标题、分类、Zotero 元数据或常识脑补；所有判断必须来自 source_text。",
		"重点关注 agent planning、agentic RL、multi-turn agent、long-horizon planning、agent memory、planning reliability。",
		"推荐等级只能使用 高 / 中 / 低；偏水风险只能使用 低 / 中 / 高；不要输出具体数字分数。",
		"motivation/method/experiments/research_help 分别写论文动机、方法、实验结果、对研究的 Insight。",
		"abstract_zh 用三到五句中文忠实改写摘要或引言中对问题和贡献的描述。",
		"card_summary 用两到三句中文概括，适合网页卡片，不要分条。",
		"full_summary 用五到八句中文完整解释论文在做什么、为什么重要、方法核心、主要实验信号和阅读价值。",
		"source_evidence 给 1 到 4 条简短证据，概括正文中支撑你判断的关键事实，不要长引用。",
		"输出严格 JSON，不要 Markdown，不要 JSON 之外的解释。",
		"",
		JSON.stringify(payload, null, 2),
	].join("\n");
}

function stripJsonFences(text) {
	return String(text || "")
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/i, "")
		.trim();
}

function parseJson(text) {
	const cleaned = stripJsonFences(text);
	try {
		return JSON.parse(cleaned);
	} catch (error) {
		const start = cleaned.indexOf("{");
		const end = cleaned.lastIndexOf("}");
		if (start !== -1 && end !== -1 && end > start) {
			return JSON.parse(cleaned.slice(start, end + 1));
		}
		throw error;
	}
}

async function callOpenAI(prompt) {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is not set");
	}
	const model = process.env.OPENAI_PAPER_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), Number(process.env.OPENAI_PAPER_TIMEOUT_MS || 180000));
	try {
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			signal: controller.signal,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model,
				temperature: 0.2,
				max_tokens: 2200,
				response_format: {
					type: "json_schema",
					json_schema: {
						name: "paper_analysis",
						strict: true,
						schema,
					},
				},
				messages: [
					{ role: "system", content: "You are a careful research assistant reading papers for a personal academic paper list." },
					{ role: "user", content: prompt },
				],
			}),
		});
		const body = await response.text();
		if (!response.ok) {
			throw new Error(`OpenAI API ${response.status}: ${body.slice(0, 1000)}`);
		}
		const data = JSON.parse(body);
		const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
		return { model, answer: parseJson(content) };
	} finally {
		clearTimeout(timeout);
	}
}

function runCodex(prompt) {
	const codex = process.env.CODEX_BIN || commandPath("codex");
	if (!codex) {
		throw new Error("codex CLI not found in PATH");
	}
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "homepage-zotero-codex-"));
	const schemaPath = path.join(tmpDir, "schema.json");
	const outputPath = path.join(tmpDir, "answer.json");
	fs.writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);

	const args = [
		"-a",
		"never",
		"exec",
		"--ephemeral",
		"--skip-git-repo-check",
		"--sandbox",
		"read-only",
		"-C",
		projectRoot,
		"--output-schema",
		schemaPath,
		"--output-last-message",
		outputPath,
	];
	const model = process.env.CODEX_PAPER_MODEL || process.env.CODEX_MODEL;
	if (model) {
		args.push("-m", model);
	}
	args.push("-");

	const result = spawnSync(codex, args, {
		input: prompt,
		encoding: "utf8",
		timeout: Number(process.env.CODEX_PAPER_TIMEOUT_MS || 360000),
		maxBuffer: 24 * 1024 * 1024,
	});
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		const output = [result.stderr, result.stdout].filter(Boolean).join("\n");
		throw new Error(`codex exec failed with status ${result.status}: ${output.slice(-5000)}`);
	}
	const answer = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : result.stdout;
	return {
		model: model || "codex-cli",
		answer: parseJson(answer),
	};
}

async function callReader(prompt) {
	if (process.env.PAPER_READER_BACKEND === "openai") {
		return callOpenAI(prompt);
	}
	return runCodex(prompt);
}

function normalizeAnalysis(answer, source, model) {
	const value = (key, fallback, maxLength = 1200) => compact(answer[key] || fallback, maxLength);
	return {
		motivation: value("motivation", "未生成动机。"),
		method: value("method", "未生成方法。"),
		experiments: value("experiments", "未生成实验结果。"),
		research_help: value("research_help", "未生成 Insight。"),
		insight: value("research_help", "未生成 Insight。"),
		abstract_zh: value("abstract_zh", "未生成中文摘要。", 1400),
		card_summary: value("card_summary", "未生成卡片摘要。", 360),
		full_summary: value("full_summary", "未生成完整摘要。", 1800),
		recommendation_level: ["高", "中", "低"].includes(answer.recommendation_level) ? answer.recommendation_level : "中",
		water_risk: ["低", "中", "高"].includes(answer.water_risk) ? answer.water_risk : "中",
		value_label: value("value_label", "待评估", 80),
		value_reason: value("value_reason", "已基于正文生成初步判断。", 420),
		limitations: value("limitations", "仍需人工复核实验设置、baseline 和开源状态。", 520),
		source_scope: source.scope,
		source_note: source.note,
		source_url: source.sourceUrl,
		arxiv_url: source.arxivUrl,
		source_evidence: Array.isArray(answer.source_evidence) ? answer.source_evidence.map((item) => compact(item, 220)).slice(0, 4) : [],
		model,
		updated_at: new Date().toISOString(),
	};
}

function unavailableAnalysis(source) {
	return {
		motivation: "未分析：没有可读取的论文正文。",
		method: "未分析：Zotero 条目没有 PDF 附件，也没有可用 arXiv/公开 PDF 链接。",
		experiments: "未分析：不能用标题或分类元数据冒充正文阅读。",
		research_help: "需要先补充论文 PDF、arXiv 链接或公开页面后再生成详情。",
		insight: "需要先补充论文 PDF、arXiv 链接或公开页面后再生成详情。",
		abstract_zh: "",
		card_summary: "未生成详情：缺少可读取正文。",
		full_summary: "这个条目当前没有可读取正文，因此未调用 ChatGPT 生成论文解读。补充 PDF 或 arXiv 链接后可重新运行脚本。",
		recommendation_level: "低",
		water_risk: "高",
		value_label: "缺正文",
		value_reason: "未基于正文分析；需要补充 PDF 或 arXiv 链接。",
		limitations: source.note,
		source_scope: source.scope,
		source_note: source.note,
		source_url: source.sourceUrl,
		arxiv_url: source.arxivUrl,
		source_evidence: [],
		model: "not-run",
		updated_at: new Date().toISOString(),
	};
}

function applyAnalysis(paper, analysis) {
	delete paper.analysis_error;
	paper.arxiv_url = analysis.arxiv_url || arxivUrlFrom(paper.url) || "";
	paper.paper_url = analysis.source_url || normalizeUrl(paper.url) || paper.arxiv_url || "";
	paper.analysis = analysis;
	paper.recommendation = {
		score: analysis.recommendation_level === "高" ? 82 : analysis.recommendation_level === "中" ? 64 : 35,
		level: analysis.recommendation_level,
		label: analysis.value_label,
		water_risk: analysis.water_risk,
		value_judgement: analysis.value_reason,
		reason: analysis.value_reason,
	};
	paper.brief = {
		card_summary: analysis.card_summary,
		full_summary: analysis.full_summary,
		abstract_zh: analysis.abstract_zh,
		summary: analysis.full_summary,
		motivation: analysis.motivation,
		method: analysis.method,
		experiments: analysis.experiments,
		research_help: analysis.research_help,
		insight: analysis.insight,
		contribution: analysis.value_reason,
		highlights: [
			analysis.value_reason,
			`偏水风险：${analysis.water_risk}`,
			`阅读来源：${analysis.source_scope === "full_text" ? "论文 PDF 正文" : "无可读正文"}`,
		],
		limitations: analysis.limitations,
	};
}

async function main() {
	const data = readJson(dataPath);
	const allItems = data.items || [];
	const onlyId = process.env.OPENAI_PAPER_ONLY_ID || "";
	const limit = Number(process.env.OPENAI_PAPER_LIMIT || allItems.length);
	const items = allItems
		.filter((paper) => !onlyId || paper.zotero_key === onlyId || paper.title === onlyId)
		.slice(0, limit);
	const cacheDir = path.join(os.tmpdir(), "junle-homepage-zotero-papers");
	fs.mkdirSync(cacheDir, { recursive: true });

	data.analysis_method =
		"ChatGPT/OpenAI reading from Zotero local PDF attachments or public PDF text; missing PDFs are marked unavailable instead of inferred from metadata.";
	data.updated_at = new Date().toISOString();

	for (const paper of items) {
		const source = await getPaperSource(paper, cacheDir);
		if (process.env.OPENAI_PAPER_SKIP_ANALYZED === "1" && paper.analysis && paper.analysis.source_scope === "full_text") {
			console.log(`Skipped ${paper.zotero_key} ${paper.title}`);
			continue;
		}
		try {
			let analysis = unavailableAnalysis(source);
			if (source.scope === "full_text") {
				const result = await callReader(buildPrompt(paper, source));
				analysis = normalizeAnalysis(result.answer, source, result.model);
			}
			applyAnalysis(paper, analysis);
			console.log(`${analysis.source_scope === "full_text" ? "Analyzed" : "Unavailable"} ${paper.zotero_key} ${paper.title}`);
		} catch (error) {
			paper.analysis_error = { message: error.message, updated_at: new Date().toISOString() };
			console.error(`Failed ${paper.zotero_key} ${paper.title}: ${error.message}`);
			if (process.env.OPENAI_PAPER_STOP_ON_ERROR === "1") {
				throw error;
			}
		}
		writeJson(dataPath, data);
	}
}

main().catch((error) => {
	console.error(error.stack || error.message);
	process.exit(1);
});
