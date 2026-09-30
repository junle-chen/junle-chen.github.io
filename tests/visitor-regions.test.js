const assert = require("assert/strict");

const visitorRegions = require("../src/js/visitor-regions.js");

const tests = [];

function runTest(name, fn) {
	tests.push({ name, fn });
}

runTest("normalizes Hong Kong geo payloads", () => {
	const region = visitorRegions.normalizeGeoPayload({
		country_code: "hk",
		country_name: "Hong Kong",
		region: "Central and Western",
		city: "Hong Kong",
	});

	assert.deepEqual(region, {
		countryCode: "HK",
		regionLabel: "Hong Kong",
		cityLabel: "Hong Kong",
	});
});

runTest("falls back to Unknown for empty geo payloads", () => {
	const region = visitorRegions.normalizeGeoPayload({});

	assert.deepEqual(region, {
		countryCode: "ZZ",
		regionLabel: "Unknown",
		cityLabel: "",
	});
});

runTest("formats visit rows by count with clean labels", () => {
	const rows = visitorRegions.formatVisitRows([
		{ country_code: "US", region_label: "United States", city_label: "Boston", visit_count: 2 },
		{ country_code: "HK", region_label: "Hong Kong", city_label: "Hong Kong", visit_count: 9 },
		{ country_code: "", region_label: "", city_label: "", visit_count: "bad" },
	]);

	assert.deepEqual(rows.slice(0, 3), [
		{ countryCode: "HK", label: "Hong Kong", detail: "Hong Kong", count: 9 },
		{ countryCode: "US", label: "United States", detail: "Boston", count: 2 },
		{ countryCode: "ZZ", label: "Unknown", detail: "", count: 0 },
	]);
});

runTest("records at most once inside the visit window", () => {
	const storage = new Map();
	const adapter = {
		getItem: (key) => storage.get(key) || null,
		setItem: (key, value) => storage.set(key, value),
	};
	const now = Date.parse("2026-06-25T08:00:00Z");
	const windowMs = 1000 * 60 * 60;

	assert.equal(visitorRegions.shouldRecordVisit(adapter, now, windowMs), true);
	visitorRegions.markVisitRecorded(adapter, now);
	assert.equal(visitorRegions.shouldRecordVisit(adapter, now + 30 * 60 * 1000, windowMs), false);
	assert.equal(visitorRegions.shouldRecordVisit(adapter, now + 2 * 60 * 60 * 1000, windowMs), true);
});

runTest("init can run without an explicit window object", () => {
	const status = { textContent: "", hidden: false, dataset: {} };
	const container = {
		querySelector: (selector) =>
			selector === "[data-visitor-region-status]" ? status : null,
	};
	const document = {
		querySelector: () => container,
	};

	assert.doesNotThrow(() => {
		visitorRegions.init({ document, container });
	});
	assert.equal(status.textContent, "Visitor stats are not configured.");
});

runTest("init still loads visit rows when recording fails", async () => {
	const status = { textContent: "", hidden: false, dataset: {} };
	const container = {
		querySelector: (selector) =>
			selector === "[data-visitor-region-status]" ? status : null,
	};
	const document = {
		querySelector: () => container,
	};
	const client = {
		rpc: () => Promise.resolve({ error: new Error("ambiguous column") }),
		from: () => ({
			select: () => ({
				order: () => ({
					limit: () =>
						Promise.resolve({
							data: [
								{
									country_code: "HK",
									region_label: "Hong Kong",
									city_label: "Hong Kong",
									visit_count: 1,
								},
							],
						}),
				}),
			}),
		}),
	};

	const rows = await visitorRegions.init({
		client,
		container,
		document,
		fetch: () =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						country_code: "HK",
						country_name: "Hong Kong",
						city: "Hong Kong",
					}),
			}),
		storage: null,
	});

	assert.deepEqual(rows, [
		{
			country_code: "HK",
			region_label: "Hong Kong",
			city_label: "Hong Kong",
			visit_count: 1,
		},
	]);
	assert.notEqual(status.textContent, "Visitor stats are unavailable.");
});

(async () => {
	for (const test of tests) {
		try {
			await test.fn();
			console.log(`ok - ${test.name}`);
		} catch (error) {
			console.error(`not ok - ${test.name}`);
			throw error;
		}
	}
})();
