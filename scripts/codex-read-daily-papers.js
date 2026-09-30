const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const dataPath = path.join(projectRoot, "src", "assets", "content", "data", "daily-papers.json");
const extractorPath = path.join(__dirname, "extract-pdf-text.py");
const bundledPython = "/Users/junle/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";

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
		"source_scope",
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
		source_scope: { type: "string", enum: ["full_text", "abstract"] },
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
	if (fs.existsSync(bundledPython)) {
		return bundledPython;
	}
	return commandPath("python3");
}

function normalizeArxivUrl(url) {
	return String(url || "").replace(/^http:\/\//, "https://");
}

function arxivPdfUrl(paper) {
	const url = normalizeArxivUrl(paper.url || paper.id || "");
	const match = url.match(/arxiv\.org\/abs\/([^?#]+)/i);
	if (!match) {
		return "";
	}
	return `https://arxiv.org/pdf/${match[1]}.pdf`;
}

function safeName(value) {
	return String(value || "paper")
		.replace(/[^a-z0-9._-]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 96);
}

async function downloadPdf(paper, cacheDir) {
	const pdfUrl = arxivPdfUrl(paper);
	if (!pdfUrl) {
		return null;
	}
	const pdfPath = path.join(cacheDir, `${safeName(paper.id || paper.title)}.pdf`);
	if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 4096) {
		return { pdfPath, pdfUrl };
	}
	const response = await fetch(pdfUrl, {
		headers: { "User-Agent": "junle-homepage-daily-paper/1.0" },
	});
	if (!response.ok) {
		throw new Error(`PDF download failed ${response.status}: ${pdfUrl}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length < 4096) {
		throw new Error(`PDF response too small: ${pdfUrl}`);
	}
	fs.writeFileSync(pdfPath, buffer);
	return { pdfPath, pdfUrl };
}

function extractTextWithPdftotext(pdfPath) {
	const pdftotext = process.env.PDFTOTEXT_PATH || commandPath("pdftotext");
	if (!pdftotext) {
		return "";
	}
	try {
		return execFileSync(pdftotext, ["-layout", pdfPath, "-"], {
			encoding: "utf8",
			maxBuffer: 24 * 1024 * 1024,
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
			maxBuffer: 24 * 1024 * 1024,
			timeout: 120000,
		});
	} catch (error) {
		return "";
	}
}

async function getPaperSource(paper, cacheDir) {
	if (process.env.CODEX_PAPER_SKIP_PDF === "1") {
		return {
			scope: "abstract",
			text: paper.summary || "",
			pdfUrl: arxivPdfUrl(paper),
			note: "PDF extraction skipped by CODEX_PAPER_SKIP_PDF=1.",
		};
	}
	try {
		const downloaded = await downloadPdf(paper, cacheDir);
		if (downloaded) {
			const text = [extractTextWithPdftotext(downloaded.pdfPath), extractTextWithPython(downloaded.pdfPath)]
				.find((value) => String(value || "").replace(/\s+/g, " ").trim().length > 1600);
			if (text) {
				return {
					scope: "full_text",
					text,
					pdfUrl: downloaded.pdfUrl,
					note: "Extracted from arXiv PDF.",
				};
			}
			return {
				scope: "abstract",
				text: paper.summary || "",
				pdfUrl: downloaded.pdfUrl,
				note: "PDF downloaded but text extraction failed; fell back to arXiv abstract.",
			};
		}
	} catch (error) {
		return {
			scope: "abstract",
			text: paper.summary || "",
			pdfUrl: arxivPdfUrl(paper),
			note: error.message,
		};
	}
	return {
		scope: "abstract",
		text: paper.summary || "",
		pdfUrl: arxivPdfUrl(paper),
		note: "No PDF URL found; fell back to arXiv abstract.",
	};
}

function compact(text, maxLength) {
	const value = String(text || "").replace(/\s+/g, " ").trim();
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength - 1).trim()}...`;
}

function buildPrompt(paper, source) {
	const maxChars = Number(process.env.CODEX_PAPER_TEXT_CHARS || 52000);
	const payload = {
		id: paper.id,
		title: paper.title,
		authors: paper.authors || [],
		date: paper.published || paper.updated || "",
		arxiv_url: normalizeArxivUrl(paper.url),
		pdf_url: source.pdfUrl,
		source_scope: source.scope,
		source_note: source.note,
		source_text: compact(source.text, maxChars),
	};
	return [
		"你是个人主页的 Daily Paper 阅读自动化。请基于提供的论文文本仔细阅读并生成中文解读。",
		"关注 agentic RL、multi-turn agent、long-horizon planning、agent planning、agent memory、planning reliability。",
		"如果 source_scope 是 abstract，只能说这是摘要级判断，不能声称已读全文。",
		"推荐等级只能使用 高 / 中 / 低；偏水风险只能使用 低 / 中 / 高；不要输出具体数字分数。",
		"请判断论文是否值得读，是否可能是水文，并给出原因。重点从论文动机、方法、实验结果、Insight 四个角度写。",
		"abstract_zh 用三到五句中文忠实改写论文摘要；如果只拿到摘要，就基于摘要翻译，不要补充摘要外信息。",
		"card_summary 用两到三句中文概括这篇文章，适合放在网页卡片上，不要分条，不要写 Motivation/Method/Result 等标签。",
		"full_summary 用四到六句中文完整解释这篇文章在做什么、为什么重要、方法核心、主要实验信号和阅读价值，适合放在详情页顶部。",
		"research_help 字段请写成 Insight：只说明对 agent planning / agentic RL / 多轮系统 / long-horizon reliability 的可迁移启发，不要出现 Junle 或 Junle research。",
		"输出必须是严格 JSON，不要 Markdown，不要解释 JSON 之外的内容。",
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

function runCodex(prompt) {
	const codex = process.env.CODEX_BIN || commandPath("codex");
	if (!codex) {
		throw new Error("codex CLI not found in PATH");
	}
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "homepage-paper-codex-"));
	const schemaPath = path.join(tmpDir, "schema.json");
	const outputPath = path.join(tmpDir, "answer.json");
	fs.writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);

	const args = [
		"-a",
		"never",
	];
	if (process.env.CODEX_PAPER_SEARCH === "1") {
		args.push("--search");
	}
	args.push(
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
		outputPath
	);
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
		const detail = output.slice(Math.max(0, output.length - 5000));
		throw new Error(`codex exec failed with status ${result.status}: ${detail}`);
	}
	const answer = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : result.stdout;
	return parseJson(answer);
}

function normalizeAnswer(answer, source, modelName) {
	const value = (key, fallback, maxLength = 900) => compact(answer[key] || fallback, maxLength);
	const sourceEvidence = Array.isArray(answer.source_evidence) && answer.source_evidence.length
		? answer.source_evidence.map((item) => compact(item, 180)).slice(0, 4)
		: [source.note || "No explicit evidence returned."];
	return {
		motivation: value("motivation", "需进一步阅读正文确认动机。"),
		method: value("method", "需进一步阅读正文确认方法。"),
		experiments: value("experiments", "需进一步阅读正文确认实验设置和结果。"),
		research_help: value("research_help", "可作为 Daily Paper 候选，先检查对 agent planning、agentic RL 或多轮系统是否有可迁移启发。"),
		insight: value("research_help", "可作为 Daily Paper 候选，先检查对 agent planning、agentic RL 或多轮系统是否有可迁移启发。"),
		abstract_zh: value("abstract_zh", answer.full_summary || answer.card_summary || "这篇论文还没有自动生成中文摘要。", 1200),
		card_summary: value("card_summary", "这篇论文还没有自动生成短概括。"),
		full_summary: value("full_summary", answer.card_summary || "这篇论文还没有自动生成完整中文概括。", 1400),
		recommendation_level: ["高", "中", "低"].includes(answer.recommendation_level)
			? answer.recommendation_level
			: "中",
		water_risk: ["低", "中", "高"].includes(answer.water_risk) ? answer.water_risk : "中",
		value_label: value("value_label", "待评估"),
		value_reason: value("value_reason", "Codex 已给出摘要级判断；需结合正文继续确认。"),
		limitations: value("limitations", ""),
		source_scope: answer.source_scope === "full_text" && source.scope === "full_text" ? "full_text" : source.scope,
		source_note: source.note,
		source_evidence: sourceEvidence,
		model: modelName || process.env.CODEX_PAPER_MODEL || process.env.CODEX_MODEL || "codex-cli",
		updated_at: new Date().toISOString(),
	};
}

function applyAnalysis(paper, analysis) {
	delete paper.analysis_error;
	paper.analysis = analysis;
	paper.recommendation = {
		...(paper.recommendation || {}),
		level: analysis.recommendation_level,
		label: analysis.value_label,
		water_risk: analysis.water_risk,
		value_judgement: analysis.value_reason,
		reason: analysis.value_reason,
	};
	paper.brief = {
		...(paper.brief || {}),
		motivation: analysis.motivation,
		method: analysis.method,
		experiments: analysis.experiments,
		research_help: analysis.research_help,
		insight: analysis.insight || analysis.research_help,
		abstract_zh: analysis.abstract_zh,
		summary: analysis.full_summary,
		full_summary: analysis.full_summary,
		card_summary: analysis.card_summary,
		contribution: analysis.value_reason,
		highlights: [
			analysis.value_reason,
			`偏水风险：${analysis.water_risk}`,
			`阅读来源：${analysis.source_scope === "full_text" ? "PDF 全文抽取" : "arXiv 摘要"}`,
		],
	};
}

async function main() {
	const data = readJson(dataPath);
	const allItems = data.items || [];
	const onlyId = process.env.CODEX_PAPER_ONLY_ID || "";
	const latestIds = Array.isArray(data.latest_item_ids)
		? data.latest_item_ids.filter(Boolean)
		: [];
	const latestIdSet = new Set(latestIds);
	const useAllItems = process.env.CODEX_PAPER_ALL_ITEMS === "1";
	const defaultItems = latestIdSet.size && !useAllItems && !onlyId
		? allItems.filter((paper) => latestIdSet.has(paper.id))
		: allItems;
	const limit = Number(process.env.CODEX_PAPER_LIMIT || defaultItems.length);
	const items = allItems
		.filter((paper) => useAllItems || onlyId || !latestIdSet.size || latestIdSet.has(paper.id))
		.filter((paper) => !onlyId || paper.id === onlyId || paper.title === onlyId)
		.slice(0, limit);
	const cacheDir = path.join(os.tmpdir(), "junle-homepage-daily-papers");
	fs.mkdirSync(cacheDir, { recursive: true });

	data.analysis_method =
		"Codex CLI paper reading from arXiv PDF text when extractable; fallback entries are marked as abstract.";
	data.automation_contract = {
		...(data.automation_contract || {}),
		runner: "npm run papers:daily:codex",
		codex_reader:
			"Downloads arXiv PDFs, extracts text with pdftotext or bundled Python PDF libraries, then calls codex exec to write Chinese motivation/method/experiment/research-help fields.",
	};

	for (const paper of items) {
		if (process.env.CODEX_PAPER_SKIP_ANALYZED === "1" && paper.analysis && !paper.analysis_error) {
			console.log(`Skipped ${paper.id || paper.title} (already analyzed)`);
			continue;
		}
		const source = await getPaperSource(paper, cacheDir);
		const prompt = buildPrompt(paper, source);
		try {
			const answer = runCodex(prompt);
			const analysis = normalizeAnswer(answer, source);
			applyAnalysis(paper, analysis);
			console.log(`Codex analyzed ${paper.id || paper.title} (${analysis.source_scope})`);
		} catch (error) {
			paper.analysis_error = {
				message: error.message,
				updated_at: new Date().toISOString(),
			};
			console.error(`Failed to analyze ${paper.id || paper.title}: ${error.message}`);
			if (process.env.CODEX_PAPER_STOP_ON_ERROR === "1") {
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
