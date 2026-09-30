(function (root, factory) {
	if (root && root.document) {
		root.JunleVisitorRegions = factory(root);
		return;
	}
	if (typeof module === "object" && module.exports) {
		module.exports = factory(root);
		return;
	}
	root.JunleVisitorRegions = factory(root);
})(typeof window !== "undefined" ? window : globalThis, function (root) {
	const STORAGE_KEY = "junle-homepage-visitor-region-recorded-at-v1";
	const DEFAULT_GEO_ENDPOINT = "https://ipapi.co/json/";
	const DEFAULT_VISIT_WINDOW_MS = 1000 * 60 * 60 * 6;
	const DEFAULT_LIMIT = 8;

	function cleanText(value, maxLength) {
		return String(value || "")
			.replace(/[<>]/g, "")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, maxLength || 80);
	}

	function normalizeCountryCode(value) {
		const code = cleanText(value, 8).toUpperCase();
		return /^[A-Z]{2}$/.test(code) ? code : "ZZ";
	}

	function normalizeGeoPayload(payload) {
		const data = payload || {};
		const regionLabel =
			cleanText(data.country_name || data.countryName || data.country || data.region || data.city, 80) ||
			"Unknown";
		return {
			countryCode: normalizeCountryCode(data.country_code || data.countryCode || data.countryCode2),
			regionLabel,
			cityLabel: cleanText(data.city, 80),
		};
	}

	function formatVisitRows(rows, limit) {
		return (Array.isArray(rows) ? rows : [])
			.map((row) => {
				const count = Number.parseInt(row && row.visit_count, 10);
				return {
					countryCode: normalizeCountryCode(row && row.country_code),
					label: cleanText(row && row.region_label, 80) || "Unknown",
					detail: cleanText(row && row.city_label, 80),
					count: Number.isFinite(count) && count > 0 ? count : 0,
				};
			})
			.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
			.slice(0, limit || DEFAULT_LIMIT);
	}

	function shouldRecordVisit(storage, now, windowMs) {
		if (!storage || typeof storage.getItem !== "function") {
			return true;
		}
		const recordedAt = Number(storage.getItem(STORAGE_KEY));
		if (!Number.isFinite(recordedAt) || recordedAt <= 0) {
			return true;
		}
		return Number(now || Date.now()) - recordedAt > (windowMs || DEFAULT_VISIT_WINDOW_MS);
	}

	function markVisitRecorded(storage, now) {
		if (!storage || typeof storage.setItem !== "function") {
			return;
		}
		try {
			storage.setItem(STORAGE_KEY, String(now || Date.now()));
		} catch (error) {
			// Visit recording is best-effort and should never block page rendering.
		}
	}

	function setStatus(container, text, state) {
		const status = container && container.querySelector("[data-visitor-region-status]");
		if (!status) {
			return;
		}
		status.textContent = text || "";
		status.hidden = !text;
		status.dataset.state = state || "";
	}

	function renderVisitRows(container, rows) {
		const list = container && container.querySelector("[data-visitor-region-list]");
		if (!list) {
			return;
		}
		const items = formatVisitRows(rows);
		list.innerHTML = "";
		if (!items.length) {
			setStatus(container, "No visit data yet.", "empty");
			return;
		}
		setStatus(container, "", "ready");
		items.forEach((item) => {
			const li = document.createElement("li");
			li.className = "visitor-region-item";
			li.innerHTML = [
				'<span class="visitor-region-code">',
				item.countryCode,
				"</span>",
				'<span class="visitor-region-main">',
				'<strong class="visitor-region-label"></strong>',
				item.detail ? '<span class="visitor-region-detail"></span>' : "",
				"</span>",
				'<span class="visitor-region-count"></span>',
			].join("");
			li.querySelector(".visitor-region-label").textContent = item.label;
			if (item.detail) {
				li.querySelector(".visitor-region-detail").textContent = item.detail;
			}
			li.querySelector(".visitor-region-count").textContent = String(item.count);
			list.appendChild(li);
		});
	}

	function createClient(windowRef) {
		const win = windowRef || root;
		const config = win.JUNLE_REALTIME_CONFIG || {};
		if (!win.supabase || !win.supabase.createClient || !config.supabaseUrl || !config.supabaseAnonKey) {
			return null;
		}
		return win.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
	}

	function fetchGeo(fetchImpl, endpoint) {
		const fetcher = fetchImpl || root.fetch;
		if (typeof fetcher !== "function") {
			return Promise.resolve(normalizeGeoPayload({}));
		}
		return fetcher(endpoint || DEFAULT_GEO_ENDPOINT, { cache: "no-store" })
			.then((response) => {
				if (!response || !response.ok) {
					throw new Error("Geo lookup failed");
				}
				return response.json();
			})
			.then(normalizeGeoPayload)
			.catch(() => normalizeGeoPayload({}));
	}

	function recordVisit(client, geo) {
		if (!client || !client.rpc) {
			return Promise.resolve();
		}
		return client
			.rpc("record_site_visit_region", {
				p_country_code: geo.countryCode,
				p_region_label: geo.regionLabel,
				p_city_label: geo.cityLabel,
			})
			.then((result) => {
				if (result && result.error) {
					throw result.error;
				}
			});
	}

	function loadVisitRows(client, limit) {
		if (!client || !client.from) {
			return Promise.resolve([]);
		}
		return client
			.from("site_visit_regions")
			.select("country_code, region_label, city_label, visit_count")
			.order("visit_count", { ascending: false })
			.limit(limit || DEFAULT_LIMIT)
			.then((result) => {
				if (result && result.error) {
					throw result.error;
				}
				return result && result.data ? result.data : [];
			});
	}

	function init(options) {
		const settings = options || {};
		const win = settings.window || root;
		const doc = settings.document || win.document;
		if (!doc) {
			return Promise.resolve([]);
		}
		const container = settings.container || doc.querySelector("[data-visitor-regions]");
		if (!container) {
			return Promise.resolve([]);
		}
		const storage = settings.storage || win.localStorage;
		const now = settings.now || Date.now();
		const client = settings.client || createClient(win);
		if (!client) {
			setStatus(container, "Visitor stats are not configured.", "error");
			return Promise.resolve([]);
		}
		setStatus(container, "Loading visitor regions...", "loading");
		const maybeRecord = shouldRecordVisit(storage, now, settings.visitWindowMs)
			? fetchGeo(settings.fetch, settings.geoEndpoint)
					.then((geo) =>
						recordVisit(client, geo).then(() => markVisitRecorded(storage, now)).catch(() => undefined)
					)
			: Promise.resolve();
		return maybeRecord
			.then(() => loadVisitRows(client, settings.limit || DEFAULT_LIMIT))
			.then((rows) => {
				renderVisitRows(container, rows);
				return rows;
			})
			.catch(() => {
				setStatus(container, "Visitor stats are unavailable.", "error");
				return [];
			});
	}

	if (typeof window !== "undefined" && window.document) {
		const boot = () => init();
		if (window.document.readyState === "loading") {
			window.document.addEventListener("DOMContentLoaded", boot, { once: true });
		} else {
			boot();
		}
	}

	return {
		STORAGE_KEY,
		DEFAULT_GEO_ENDPOINT,
		DEFAULT_VISIT_WINDOW_MS,
		normalizeGeoPayload,
		formatVisitRows,
		shouldRecordVisit,
		markVisitRecorded,
		renderVisitRows,
		init,
	};
});
