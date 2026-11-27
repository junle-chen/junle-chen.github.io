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
	const DEFAULT_GEO_ENDPOINT = "https://api.country.is/";
	const FALLBACK_GEO_ENDPOINT = "https://ipapi.co/json/";
	const GEO_TIMEOUT_MS = 3000;
	const DEFAULT_VISIT_WINDOW_MS = 1000 * 60 * 60 * 6;
	const DEFAULT_LIMIT = 8;
	const VISIT_PAGE_SIZE = 500;
	const regionNames = typeof Intl.DisplayNames === "function"
		? new Intl.DisplayNames(["en"], { type: "region", fallback: "none" })
		: null;

	function cleanText(value, maxLength) {
		return String(value || "")
			.replace(/[<>]/g, "")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, maxLength || 80);
	}

	function normalizeCountryCode(value) {
		const code = cleanText(value, 8).toUpperCase();
		return /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : "ZZ";
	}

	function normalizeGeoPayload(payload) {
		const data = payload || {};
		const countryCode = normalizeCountryCode(data.country_code || data.country || data.countryCode);
		if (data.error || countryCode === "ZZ") {
			return null;
		}
		return {
			countryCode,
			regionLabel: cleanText(data.country_name, 80) || (regionNames && regionNames.of(countryCode)) || countryCode,
		};
	}

	function formatVisitRows(rows, limit) {
		const byCountry = new Map();
		for (const row of Array.isArray(rows) ? rows : []) {
			const count = Number(row && row.visit_count);
			if (!Number.isSafeInteger(count) || count <= 0) {
				continue;
			}
			const countryCode = normalizeCountryCode(row.country_code);
			if (countryCode === "ZZ") {
				continue;
			}
			const country = byCountry.get(countryCode);
			if (country) {
				country.count += count;
			} else {
				const label = (regionNames && regionNames.of(countryCode)) || cleanText(row.region_label, 80) || countryCode;
				byCountry.set(countryCode, { countryCode, label, count });
			}
		}
		return [...byCountry.values()]
			.sort((a, b) => b.count - a.count || a.countryCode.localeCompare(b.countryCode))
			.slice(0, limit || DEFAULT_LIMIT);
	}

	function shouldRecordVisit(storage, now, windowMs) {
		if (!storage || typeof storage.getItem !== "function") {
			return true;
		}
		let recordedAt;
		try {
			recordedAt = Number(storage.getItem(STORAGE_KEY));
		} catch (error) {
			return true;
		}
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
		const translations = {
			"No visit data yet.": "暂无访问数据。",
			"Visitor stats are not configured.": "尚未配置访客统计。",
			"Loading visitor regions...": "正在加载访客地区…",
			"Visitor stats are unavailable.": "暂时无法获取访客统计。",
		};
		status.dataset.message = text || "";
		status.textContent = root.JunleLanguage && root.JunleLanguage.current === "zh" ? translations[text] || text || "" : text || "";
		status.hidden = !text;
		status.dataset.state = state || "";
	}

	function renderVisitRows(container, rows, limit) {
		const list = container && container.querySelector("[data-visitor-region-list]");
		if (!list) {
			return;
		}
		const regions = formatVisitRows(rows, limit);
		list.innerHTML = "";
		if (!regions.length) {
			setStatus(container, "No visit data yet.", "empty");
			return;
		}
		setStatus(container, "", "ready");
		regions.forEach((item) => {
			const li = list.ownerDocument.createElement("li");
			li.className = "visitor-region-item";
			li.innerHTML =
				'<span class="visitor-region-code"></span>' +
				'<span class="visitor-region-main"><strong class="visitor-region-label"></strong></span>' +
				'<span class="visitor-region-count"></span>';
			li.querySelector(".visitor-region-code").textContent = item.countryCode;
			li.querySelector(".visitor-region-label").textContent = item.label;
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

	async function fetchGeo(fetcher, endpoints) {
		for (const endpoint of endpoints) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
			try {
				const response = await fetcher(endpoint, { cache: "no-store", signal: controller.signal });
				const geo = response.ok ? normalizeGeoPayload(await response.json()) : null;
				if (geo) {
					return geo;
				}
			} catch (error) {
				// A blocked, timed-out, or malformed response should allow the next provider to run.
			} finally {
				clearTimeout(timeout);
			}
		}
		return null;
	}

	async function recordVisit(client, storage, now, settings, win) {
		const fetcher = settings.fetch || (win.fetch && win.fetch.bind(win));
		if (!client.rpc || !fetcher || !shouldRecordVisit(storage, now, settings.visitWindowMs)) {
			return false;
		}
		try {
			const geo = await fetchGeo(fetcher, settings.geoEndpoint
				? [settings.geoEndpoint]
				: [DEFAULT_GEO_ENDPOINT, FALLBACK_GEO_ENDPOINT]);
			if (!geo) {
				return false;
			}
			const { error } = await client.rpc("record_site_visit_region", {
				p_country_code: geo.countryCode,
				p_region_label: geo.regionLabel,
				p_city_label: "",
			});
			if (error) {
				return false;
			}
			markVisitRecorded(storage, now);
			return true;
		} catch (error) {
			return false;
		}
	}

	async function loadVisitRows(client) {
		const rows = [];
		let lastId;
		for (;;) {
			const query = client.from("site_visit_regions")
				.select("id, country_code, region_label, visit_count")
				.order("id")
				.limit(VISIT_PAGE_SIZE);
			const { data, error } = await (lastId ? query.gt("id", lastId) : query);
			if (error) {
				throw error;
			}
			rows.push(...data);
			if (data.length < VISIT_PAGE_SIZE) {
				return rows;
			}
			lastId = data[data.length - 1].id;
		}
	}

	async function init(options) {
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
		const now = settings.now || Date.now();
		const client = settings.client || createClient(win);
		if (!client) {
			setStatus(container, "Visitor stats are not configured.", "error");
			return Promise.resolve([]);
		}
		setStatus(container, "Loading visitor regions...", "loading");
		const showRows = (rows) => {
			renderVisitRows(container, rows, settings.limit);
			return rows;
		};
		const displayedRows = loadVisitRows(client)
			.then(showRows)
			.catch(() => {
				setStatus(container, "Visitor stats are unavailable.", "error");
				return [];
			});
		let storage = settings.storage;
		if (storage === undefined) {
			try {
				storage = win.localStorage;
			} catch (error) {
				// Some browser privacy settings disable local storage.
			}
		}
		const recorded = await recordVisit(client, storage, now, settings, win);
		const rows = await displayedRows;
		return recorded ? loadVisitRows(client).then(showRows).catch(() => rows) : rows;
	}

	if (typeof window !== "undefined" && window.document) {
		window.document.addEventListener("junle:languagechange", () => {
			const container = window.document.querySelector("[data-visitor-regions]");
			const status = container && container.querySelector("[data-visitor-region-status]");
			if (status) setStatus(container, status.dataset.message, status.dataset.state);
		});
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
