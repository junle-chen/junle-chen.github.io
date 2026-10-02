const namedEntities = {
	amp: "&",
	apos: "'",
	gt: ">",
	lt: "<",
	nbsp: " ",
	quot: '"',
};

export function validateBlogUrl(raw) {
	const value = String(raw || "").trim();
	if (!value || value.length > 2048) {
		throw new Error("请输入不超过 2048 字符的网页链接");
	}
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error("请输入完整的 http 或 https 网页链接");
	}
	const host = url.hostname.toLowerCase().replace(/\.$/, "");
	if (
		(url.protocol !== "http:" && url.protocol !== "https:") ||
		url.username ||
		url.password ||
		(url.port && !["80", "443"].includes(url.port)) ||
		!host.includes(".") ||
		/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) ||
		host.includes(":") ||
		/(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(host)
	) {
		throw new Error("仅支持公开网站的标准 http/https 链接");
	}
	url.hash = "";
	return url.toString();
}

function decodeEntities(value) {
	return String(value || "").replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (full, code) => {
		if (code[0] === "#") {
			const number = code[1].toLowerCase() === "x"
				? parseInt(code.slice(2), 16)
				: parseInt(code.slice(1), 10);
			return Number.isFinite(number) && number > 0 && number <= 0x10ffff
				? String.fromCodePoint(number)
				: full;
		}
		return namedEntities[code.toLowerCase()] || full;
	});
}

function cleanText(value, maxLength) {
	return decodeEntities(String(value || "").replace(/<[^>]*>/g, " "))
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxLength);
}

export function extractBlogMetadata(html, sourceUrl) {
	const metadata = {};
	const tags = String(html || "").match(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) || [];
	for (const tag of tags) {
		const attrs = {};
		const attributePattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
		for (const match of tag.matchAll(attributePattern)) {
			attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
		}
		const name = String(attrs.property || attrs.name || "").toLowerCase();
		if (name && attrs.content && !metadata[name]) {
			metadata[name] = attrs.content;
		}
	}
	const titleTag = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
	const fallbackHost = new URL(sourceUrl).hostname;
	return {
		title: cleanText(metadata["og:title"] || metadata["twitter:title"] || titleTag?.[1] || fallbackHost, 300),
		summary: cleanText(metadata["og:description"] || metadata.description || metadata["twitter:description"] || "", 2000),
	};
}
