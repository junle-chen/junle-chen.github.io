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
	});
});

runTest("normalizes Country.is and rejects unusable geo responses", () => {
	assert.deepEqual(visitorRegions.normalizeGeoPayload({ country: "jp" }), {
		countryCode: "JP",
		regionLabel: "Japan",
	});
	assert.equal(visitorRegions.normalizeGeoPayload({}), null);
	assert.equal(visitorRegions.normalizeGeoPayload({ country: "XX" }), null);
	assert.equal(visitorRegions.normalizeGeoPayload({ country_code: "US", error: true }), null);
});

runTest("groups historical cities by country before ranking and keeps Unknown separate", () => {
	const rows = visitorRegions.formatVisitRows([
		{ country_code: "US", region_label: "United States", city_label: "Boston", visit_count: 8 },
		{ country_code: "US", region_label: "United States", city_label: "Santa Clara", visit_count: 7 },
		{ country_code: "HK", region_label: "Hong Kong", city_label: "Hong Kong", visit_count: 9 },
		{ country_code: "ZZ", region_label: "Unknown", city_label: "", visit_count: 20 },
		{ country_code: "", region_label: "", city_label: "", visit_count: "bad" },
	], 1);

	assert.deepEqual(rows, {
		regions: [{ countryCode: "US", label: "United States", count: 15 }],
		unknownCount: 20,
	});
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

function visitFixture(rows, rpc) {
	const status = { textContent: "", hidden: false, dataset: {} };
	const container = {
		querySelector: (selector) =>
			selector === "[data-visitor-region-status]" ? status : null,
	};
	const document = {
		querySelector: () => container,
	};
	const readPages = [];
	const client = {
		rpc,
		from: () => ({
			select: () => ({
				order: () => ({
					limit: (size) => {
						const read = (lastId) => {
							readPages.push(lastId);
							return Promise.resolve({ data: rows.filter((row) => row.id > lastId).slice(0, size) });
						};
						return {
							then: (resolve, reject) => read(0).then(resolve, reject),
							gt: (column, lastId) => read(lastId),
						};
					},
				}),
			}),
		}),
	};
	const values = new Map();
	const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
	return { status, readPages, options: { client, container, document, storage } };
}

runTest("records the fallback region when the primary provider returns 429", async () => {
	const requests = [];
	const writes = [];
	const fixture = visitFixture([], async (name, payload) => {
		writes.push([name, payload]);
		return { error: null };
	});
	await visitorRegions.init({
		...fixture.options,
		fetch: async (url) => {
			requests.push(url);
			return url === visitorRegions.DEFAULT_GEO_ENDPOINT
				? { ok: false, status: 429 }
				: { ok: true, json: async () => ({ country_code: "HK", country_name: "Hong Kong", city: "Hong Kong" }) };
		},
	});
	assert.deepEqual(requests, ["https://api.country.is/", "https://ipapi.co/json/"]);
	assert.deepEqual(writes, [
		["record_site_visit_region", { p_country_code: "HK", p_region_label: "Hong Kong", p_city_label: "" }],
	]);
	assert.ok(fixture.options.storage.getItem(visitorRegions.STORAGE_KEY));
});

runTest("renders and reads saved rows independently of a pending lookup", async () => {
	const savedRows = [{ id: 1, country_code: "SG", region_label: "Singapore", visit_count: 1 }];
	const fixture = visitFixture(savedRows, async () => assert.fail("invalid geo should not be recorded"));
	let finishLookup;
	const pendingLookup = new Promise((resolve) => { finishLookup = resolve; });
	const init = visitorRegions.init({
		...fixture.options,
		fetch: async (url) => url === visitorRegions.DEFAULT_GEO_ENDPOINT
			? pendingLookup
			: { ok: true, json: async () => ({ error: true }) },
	});
	await new Promise(setImmediate);
	assert.deepEqual(fixture.readPages, [0]);
	finishLookup({ ok: false, status: 429 });
	assert.deepEqual(await init, savedRows);
	assert.equal(fixture.options.storage.getItem(visitorRegions.STORAGE_KEY), undefined);
});

runTest("still loads visit rows when recording fails and leaves the next visit eligible", async () => {
	const savedRows = [{ id: 1, country_code: "HK", region_label: "Hong Kong", visit_count: 1 }];
	const fixture = visitFixture(savedRows, async () => ({ error: new Error("ambiguous column") }));
	const requests = [];
	const rows = await visitorRegions.init({
		...fixture.options,
		fetch: async (url) => {
			requests.push(url);
			return { ok: true, json: async () => ({ country: "JP" }) };
		},
	});
	assert.deepEqual(requests, [visitorRegions.DEFAULT_GEO_ENDPOINT]);
	assert.deepEqual(rows, savedRows);
	assert.equal(fixture.options.storage.getItem(visitorRegions.STORAGE_KEY), undefined);
	assert.notEqual(fixture.status.textContent, "Visitor stats are unavailable.");
});

runTest("reads historical regions past the first page", async () => {
	const savedRows = Array.from({ length: 501 }, (_, index) => ({ id: index + 1, country_code: "JP", visit_count: 1 }));
	const fixture = visitFixture(savedRows);
	assert.deepEqual(await visitorRegions.init(fixture.options), savedRows);
	assert.deepEqual(fixture.readPages, [0, 500]);
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
