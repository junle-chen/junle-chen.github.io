const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot =
	process.env.JUNLE_CC_WEBSITE ||
	path.resolve(projectRoot, "..", "junle-cc-website");
const contentRoot = path.join(projectRoot, "src", "assets", "content");
const dataRoot = path.join(projectRoot, "src", "data");

function assertExists(target, label) {
	if (!fs.existsSync(target)) {
		throw new Error(`${label} not found: ${target}`);
	}
}

function ensureDir(target) {
	fs.mkdirSync(target, { recursive: true });
}

function copyPath(source, target) {
	assertExists(source, "Source path");
	ensureDir(path.dirname(target));
	fs.cpSync(source, target, {
		recursive: true,
		force: true,
		filter: (entry) => {
			const name = path.basename(entry);
			return name !== "__pycache__" && !name.endsWith(".pyc");
		},
	});
}

function readText(file) {
	return fs.readFileSync(file, "utf8");
}

function listFiles(root, predicate) {
	const files = [];
	function walk(current) {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const fullPath = path.join(current, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
			} else if (!predicate || predicate(fullPath)) {
				files.push(fullPath);
			}
		}
	}
	walk(root);
	return files;
}

function splitFrontMatter(content) {
	if (!content.startsWith("---")) {
		return { frontMatter: {}, body: content };
	}

	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) {
		return { frontMatter: {}, body: content };
	}

	const frontMatter = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!kv) {
			continue;
		}
		const key = kv[1];
		let value = kv[2].trim();
		value = value.replace(/^["']|["']$/g, "");
		if (value.startsWith("[") && value.endsWith("]")) {
			value = value
				.slice(1, -1)
				.split(",")
				.map((item) => item.trim().replace(/^["']|["']$/g, ""))
				.filter(Boolean);
		}
		frontMatter[key] = value;
	}

	return { frontMatter, body: content.slice(match[0].length) };
}

function stripMarkdown(content) {
	return content
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/[#>*_`~\-|]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function truncate(text, length) {
	if (!text) {
		return "";
	}
	return text.length > length ? `${text.slice(0, length - 1).trim()}...` : text;
}

function titleFromFilename(filename) {
	const base = path.basename(filename, ".md");
	const dated = base.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[-\s_]*(.+)$/);
	if (dated) {
		return dated[4].replace(/[_-]+/g, " ").trim();
	}
	return base.replace(/[_-]+/g, " ").trim();
}

function dateFromFilename(filename) {
	const base = path.basename(filename, ".md");
	const dated = base.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
	if (!dated) {
		return "";
	}
	return `${dated[1]}-${dated[2].padStart(2, "0")}-${dated[3].padStart(2, "0")}`;
}

function inferCategory(title) {
	const lower = title.toLowerCase();
	if (/motion|trajectory|forecast|urban|spatio|tnt|hivt|multipath/.test(lower)) {
		return "Motion & Urban AI";
	}
	if (/llm|rlhf|lora|language model|agent/.test(lower)) {
		return "LLM Notes";
	}
	if (/pyenv|linux|mac|azure|campus|num_workers|分区|权限|服务器/.test(lower)) {
		return "Engineering Log";
	}
	if (/math|公式|benchmark|evaluation|training/.test(lower)) {
		return "Research Notes";
	}
	return "Notebook";
}

function toUrlPath(relativePath) {
	return relativePath.split(path.sep).map(encodeURIComponent).join("/");
}

function parseNotes() {
	const postsRoot = path.join(sourceRoot, "_posts");
	assertExists(postsRoot, "Posts directory");

	return listFiles(postsRoot, (file) => file.endsWith(".md"))
		.filter((file) => !file.includes(`${path.sep}templates${path.sep}`))
		.map((file) => {
			const relative = path.relative(postsRoot, file);
			const { frontMatter, body } = splitFrontMatter(readText(file));
			const title = frontMatter.title || titleFromFilename(file);
			const tags = Array.isArray(frontMatter.tags)
				? frontMatter.tags
				: frontMatter.tags
				? [frontMatter.tags]
				: [inferCategory(title)];
			const date = frontMatter.date || dateFromFilename(file);
			const excerpt = truncate(stripMarkdown(frontMatter.subtitle || body), 170);
			return {
				title,
				date,
				category: inferCategory(title),
				tags,
				excerpt,
				url: `assets/content/notes/${toUrlPath(relative)}`,
				search: [title, date, tags.join(" "), excerpt].join(" ").toLowerCase(),
			};
		})
		.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function parseYamlScalar(value) {
	const trimmed = value.trim();
	if (trimmed === "true") {
		return true;
	}
	if (trimmed === "false") {
		return false;
	}
	if (/^\d+$/.test(trimmed)) {
		return Number(trimmed);
	}
	return trimmed.replace(/^["']|["']$/g, "");
}

function parseMemos() {
	const memoFile = path.join(sourceRoot, "_data", "memos.yml");
	if (!fs.existsSync(memoFile)) {
		return [];
	}

	const memos = [];
	let current = null;
	for (const line of readText(memoFile).split(/\r?\n/)) {
		if (!line.trim() || line.trim().startsWith("#")) {
			continue;
		}
		const item = line.match(/^-\s+([A-Za-z0-9_-]+):\s*(.*)$/);
		if (item) {
			current = {};
			current[item[1]] = parseYamlScalar(item[2]);
			memos.push(current);
			continue;
		}
		const kv = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
		if (kv && current) {
			current[kv[1]] = parseYamlScalar(kv[2]);
		}
	}

	return memos.map((memo) => ({
		id: memo.id,
		title: memo.title || "Untitled memo",
		content: memo.content || "",
		category: memo.category || "general",
		priority: memo.priority || "normal",
		date: memo.date || "",
		completed: Boolean(memo.completed),
	}));
}

function readJson(relativePath, fallback) {
	const file = path.join(sourceRoot, relativePath);
	if (!fs.existsSync(file)) {
		return fallback;
	}
	return JSON.parse(readText(file));
}

function buildResources() {
	return [
		{
			title: "Academic Page",
			description: "Existing academic homepage linked from the old Resources menu.",
			href: "https://junle-chen.github.io/",
			type: "External",
		},
		{
			title: "GitHub Repositories",
			description: "Project and research code collection.",
			href: "https://github.com/junle-chen?tab=repositories",
			type: "External",
		},
		{
			title: "Paper Radar Source",
			description: "Original Jekyll page for the paper tracking view.",
			href: "assets/content/pages/papers.md",
			type: "Data",
		},
		{
			title: "Old Site README",
			description: "Source-site setup notes and project context.",
			href: "assets/content/pages/README.md",
			type: "Archive",
		},
	];
}

function unique(values) {
	return Array.from(new Set(values.filter(Boolean)));
}

function importContent() {
	assertExists(sourceRoot, "junle-cc-website");
	ensureDir(contentRoot);
	ensureDir(dataRoot);

	copyPath(path.join(sourceRoot, "_posts"), path.join(contentRoot, "notes"));
	copyPath(path.join(sourceRoot, "_data"), path.join(contentRoot, "data"));
	copyPath(path.join(sourceRoot, "docs"), path.join(contentRoot, "docs"));
	copyPath(path.join(sourceRoot, "assets"), path.join(contentRoot, "assets"));
	copyPath(path.join(sourceRoot, "scripts"), path.join(contentRoot, "scripts"));

	const pageRoot = path.join(contentRoot, "pages");
	ensureDir(pageRoot);
	for (const page of [
		"README.md",
		"aboutme.md",
		"memos.md",
		"papers.md",
		"MEMO_GUIDE.md",
		"MEMO_README.md",
		"MEMO_SYSTEM_README.md",
		"MEMO_TOKEN_GUIDE.md",
		"QUICK_START_MEMOS.md",
		"pytorch num_workers 问题.md",
	]) {
		const source = path.join(sourceRoot, page);
		if (fs.existsSync(source)) {
			copyPath(source, path.join(pageRoot, page));
		}
	}

	const avatar = path.join(sourceRoot, "assets", "img", "hanppy-AnyEraser.png");
	if (fs.existsSync(avatar)) {
		copyPath(avatar, path.join(projectRoot, "src", "assets", "avatar.png"));
	}

	const notes = parseNotes();
	const memos = parseMemos();
	const papers = readJson("_data/papers.json", {
		updated_at: "",
		topics: [],
		items: [],
	});
	const paperTopics = readJson("_data/paper_topics.json", { queries: [] });
	const resources = buildResources();
	const categories = unique(notes.map((note) => note.category));
	const importedAt = new Date().toISOString().slice(0, 10);

	const homepage = {
		imported_at: importedAt,
		source: sourceRoot,
		stats: {
			notes: notes.length,
			memos: memos.length,
			papers: papers.items ? papers.items.length : 0,
			resources: resources.length,
			assets: listFiles(path.join(sourceRoot, "assets")).length,
		},
		highlights: [
			"Notes and bug records migrated from the old Jekyll site.",
			"Memo data is shown as an owner-editable local timeline.",
			"Paper Radar data is ready for future Zotero/arXiv updates.",
		],
		notes,
		memos,
		papers,
		paper_topics: paperTopics,
		categories,
		resources,
	};

	const homepageJson = `${JSON.stringify(homepage, null, 2)}\n`;
	fs.writeFileSync(path.join(dataRoot, "homepage-content.json"), homepageJson);
	fs.writeFileSync(path.join(contentRoot, "homepage-content.json"), homepageJson);

	console.log(
		`Imported ${notes.length} notes, ${memos.length} memos, ${resources.length} resources from ${sourceRoot}`
	);
}

importContent();
