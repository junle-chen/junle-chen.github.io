import { extractBlogMetadata, validateBlogUrl } from "./metadata.mjs";

const ownerUserId = "9cbda636-f280-4cff-af6c-408e6dd4e59a";
const allowedOrigins = new Set([
	"https://junle-chen.github.io",
	"http://localhost:8080",
	"http://127.0.0.1:8080",
]);

function corsHeaders(origin: string | null): Record<string, string> {
	return origin && allowedOrigins.has(origin)
		? {
			"Access-Control-Allow-Origin": origin,
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
			Vary: "Origin",
		}
		: {};
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
	});
}

async function readHtml(response: Response): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) return "";
	const parts: Uint8Array[] = [];
	let length = 0;
	try {
		while (length < 512_000) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = value.slice(0, 512_000 - length);
			parts.push(chunk);
			length += chunk.length;
		}
	} finally {
		await reader.cancel().catch(() => {});
	}
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.length;
	}
	const charset = response.headers.get("content-type")?.match(/charset=([^;\s]+)/i)?.[1] || "utf-8";
	try {
		return new TextDecoder(charset).decode(bytes);
	} catch {
		return new TextDecoder("utf-8").decode(bytes);
	}
}

async function fetchMetadata(input: string): Promise<{ url: string; title: string; summary: string }> {
	let url = validateBlogUrl(input);
	for (let redirect = 0; redirect < 4; redirect += 1) {
		const response = await fetch(url, {
			redirect: "manual",
			signal: AbortSignal.timeout(8_000),
			headers: { Accept: "text/html,application/xhtml+xml" },
		});
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			if (!location) throw new Error("网页跳转缺少目标地址");
			url = validateBlogUrl(new URL(location, url).toString());
			continue;
		}
		if (!response.ok) throw new Error("网页暂时无法读取，可手动填写标题和摘要");
		const contentType = response.headers.get("content-type") || "";
		if (contentType && !/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
			throw new Error("该链接不是 HTML 网页");
		}
		const html = await readHtml(response);
		return { url, ...extractBlogMetadata(html, url) };
	}
	throw new Error("网页跳转次数过多");
}

Deno.serve(async (request: Request) => {
	const origin = request.headers.get("origin");
	if (origin && !allowedOrigins.has(origin)) {
		return jsonResponse({ error: "Origin not allowed" }, 403, origin);
	}
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders(origin) });
	}
	if (request.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405, origin);
	}
	const authorization = request.headers.get("authorization") || "";
	if (!authorization.startsWith("Bearer ")) {
		return jsonResponse({ error: "Sign in required" }, 401, origin);
	}
	const supabaseUrl = Deno.env.get("SUPABASE_URL");
	const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
	if (!supabaseUrl || !anonKey) {
		return jsonResponse({ error: "Import service is not configured" }, 503, origin);
	}
	try {
		const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
			headers: { Authorization: authorization, apikey: anonKey },
			signal: AbortSignal.timeout(5_000),
		});
		if (!authResponse.ok) {
			return jsonResponse({ error: "Sign in required" }, 401, origin);
		}
		const user = await authResponse.json();
		if (user?.id !== ownerUserId) {
			return jsonResponse({ error: "Only the site owner can import blogs" }, 403, origin);
		}
		const raw = await request.text();
		if (raw.length > 4_096) {
			return jsonResponse({ error: "Request too large" }, 413, origin);
		}
		const input = JSON.parse(raw);
		const metadata = await fetchMetadata(input?.url);
		return jsonResponse(metadata, 200, origin);
	} catch (error) {
		const message = error instanceof Error ? error.message : "网页信息读取失败";
		return jsonResponse({ error: message }, 400, origin);
	}
});
