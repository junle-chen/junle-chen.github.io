#!/usr/bin/env node

// Request a deployment of committed ac-homepage source without copying GitHub
// credentials or including uncommitted local content in the published site.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const sourceRepository = "junle-chen/ac-homepage";
const publisherRepository = "junle-chen/junle-chen.github.io";
const publisherUrl = `https://github.com/${publisherRepository}.git`;
const markerPath = "publish-source.json";
const liveManifestUrl = "https://junle-chen.github.io/deployment-source.json";
const flags = new Set(process.argv.slice(2));
const acceptedFlags = new Set(["--dry-run", "--wait", "--force"]);
for (const flag of flags) {
	if (!acceptedFlags.has(flag)) throw new Error(`Unknown option: ${flag}`);
}

function git(args, options = {}) {
	return execFileSync("git", args, {
		encoding: "utf8",
		maxBuffer: 10 * 1024 * 1024,
		env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
		...options,
	});
}

async function waitForDeployment(revision) {
	const deadline = Date.now() + 10 * 60 * 1000;
	console.log(`Waiting for https://junle-chen.github.io/ to publish ${revision.slice(0, 7)}...`);
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${liveManifestUrl}?ts=${Date.now()}`, {
				cache: "no-store",
				signal: AbortSignal.timeout(15000),
			});
			if (response.ok) {
				const manifest = await response.json();
				if (manifest.sourceRepository === sourceRepository && manifest.sourceRevision === revision) {
					console.log(`Verified deployed source ${revision} at https://junle-chen.github.io/`);
					return;
				}
			}
		} catch (error) {
			// DNS, TLS and CDN propagation can briefly lag a successful deployment.
		}
		await new Promise(resolve => setTimeout(resolve, 15000));
	}
	throw new Error("Deployment was requested but not verified within 10 minutes. Check the publisher repository's Actions page.");
}

async function main() {
	const root = git(["rev-parse", "--show-toplevel"]).trim();
	process.chdir(root);
	const origin = git(["remote", "get-url", "origin"]).trim();
	if (!/^https:\/\/github\.com\/junle-chen\/ac-homepage(?:\.git)?$/.test(origin)) {
		throw new Error("Run this publisher from the junle-chen/ac-homepage source repository.");
	}
	const revision = git(["rev-parse", "HEAD"]).trim();
	const remoteMain = git(["ls-remote", "origin", "refs/heads/main"]).trim().split(/\s+/)[0];
	if (revision !== remoteMain) throw new Error("Commit and push the intended source to main before publishing.");
	const homepage = JSON.parse(git(["show", `${revision}:package.json`])).homepage;
	if (homepage !== "https://junle-chen.github.io") throw new Error("Committed homepage must be https://junle-chen.github.io.");
	try {
		git(["cat-file", "-e", `${revision}:CNAME`], { stdio: ["pipe", "pipe", "pipe"] });
		throw new Error("Remove the source CNAME before publishing the GitHub root site.");
	} catch (error) {
		if (!Number.isInteger(error.status)) throw error;
	}
	if (flags.has("--dry-run")) {
		console.log(JSON.stringify({ sourceRepository, sourceRevision: revision, publisherRepository, publisherBranch: "master", siteUrl: "https://junle-chen.github.io/" }, null, 2));
		return;
	}

	git(["fetch", "--quiet", publisherUrl, "master"]);
	const parent = git(["rev-parse", "FETCH_HEAD"]).trim();
	let previous;
	try {
		previous = JSON.parse(git(["show", `${parent}:${markerPath}`], { stdio: ["pipe", "pipe", "pipe"] }));
	} catch (error) {
		previous = undefined;
	}
	if (previous?.sourceRevision === revision && !flags.has("--force")) {
		console.log(`Deployment of ${revision.slice(0, 7)} has already been requested.`);
	} else {
		const directory = await fs.mkdtemp(path.join(os.tmpdir(), "homepage-publish-"));
		const environment = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_INDEX_FILE: path.join(directory, "index") };
		try {
			git(["read-tree", parent], { env: environment });
			const marker = JSON.stringify({ sourceRepository, sourceRevision: revision, requestedAt: new Date().toISOString() }, null, 2) + "\n";
			const blob = git(["hash-object", "-w", "--stdin"], { input: marker }).trim();
			git(["update-index", "--add", "--cacheinfo", "100644", blob, markerPath], { env: environment });
			const tree = git(["write-tree"], { env: environment }).trim();
			const commit = git(["commit-tree", tree, "-p", parent, "-m", `Publish ac-homepage ${revision.slice(0, 7)}`]).trim();
			const changed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", parent, commit]).trim();
			if (changed !== markerPath) throw new Error("Publisher request would alter unexpected repository files.");
			git(["push", publisherUrl, `${commit}:refs/heads/master`], { stdio: "inherit" });
			console.log(`Requested deployment of committed source ${revision}; local edits were preserved.`);
		} finally {
			await fs.rm(directory, { recursive: true, force: true });
		}
	}
	if (flags.has("--wait")) await waitForDeployment(revision);
}

main().catch(error => {
	console.error(error.message);
	process.exitCode = 1;
});
