import assert from "node:assert/strict";
import test from "node:test";
import {
	extractBlogMetadata,
	validateBlogUrl,
} from "../supabase/functions/blog-metadata/metadata.mjs";

test("metadata import accepts public blog URLs and strips fragments", () => {
	assert.equal(
		validateBlogUrl("https://example.com/post?a=1#comments"),
		"https://example.com/post?a=1"
	);
});

test("metadata import rejects local destinations and non-web schemes", () => {
	for (const url of [
		"http://127.0.0.1/private",
		"http://localhost/admin",
		"http://[::1]/",
		"https://blog.local/post",
		"file:///etc/passwd",
		"https://user:pass@example.com/",
		"https://example.com:8443/",
	]) {
		assert.throws(() => validateBlogUrl(url), { message: /仅支持/ });
	}
});

test("metadata import reads Open Graph and escaped HTML as plain text", () => {
	const result = extractBlogMetadata(
		'<html><head><title>Fallback</title><meta content="Agents &amp; Tools" property="og:title"><meta name="description" content="Read &amp; learn"><meta property="og:description" content="A &lt;safe&gt; overview"></head></html>',
		"https://example.com/post"
	);
	assert.deepEqual(result, {
		title: "Agents & Tools",
		summary: "A <safe> overview",
	});
});

test("metadata import keeps comparison signs inside quoted descriptions", () => {
	const result = extractBlogMetadata(
		'<meta name="description" content="Method A > Method B in this benchmark">',
		"https://example.com/post"
	);
	assert.equal(result.summary, "Method A > Method B in this benchmark");
});
