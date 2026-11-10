(function () {
	"use strict";

	const storageKey = "junle-homepage-language-v1";
	const attributes = ["placeholder", "aria-label", "alt", "original-content"];
	const originals = new WeakMap();
	const nodes = document.querySelectorAll("[data-zh], [data-zh-placeholder], [data-zh-aria-label], [data-zh-alt], [data-zh-original-content]");
	let current = "en";

	nodes.forEach((node) => {
		const values = { text: node.textContent };
		attributes.forEach((attribute) => { values[attribute] = node.getAttribute(attribute); });
		originals.set(node, values);
	});

	function normalize(value) {
		return /^zh(?:-|$)/i.test(value || "") ? "zh" : /^en(?:-|$)/i.test(value || "") ? "en" : null;
	}

	function preferredLanguage() {
		const query = normalize(new URL(window.location.href).searchParams.get("lang"));
		if (query) return query;
		try {
			const saved = normalize(window.localStorage.getItem(storageKey));
			if (saved) return saved;
		} catch (error) {
			// Language switching also works when browser storage is disabled.
		}
		return normalize(window.navigator.language) || "en";
	}

	function apply(language, persist) {
		current = normalize(language) || "en";
		document.documentElement.lang = current === "zh" ? "zh-CN" : "en";
		nodes.forEach((node) => {
			const original = originals.get(node);
			if (node.hasAttribute("data-zh")) {
				node.textContent = current === "zh" ? node.getAttribute("data-zh") : original.text;
			}
			attributes.forEach((attribute) => {
				if (node.hasAttribute("data-zh-" + attribute)) {
					node.setAttribute(attribute, current === "zh" ? node.getAttribute("data-zh-" + attribute) : original[attribute]);
				}
			});
		});
		document.querySelectorAll("[data-language]").forEach((button) => {
			const active = button.dataset.language === current;
			button.classList.toggle("is-active", active);
			button.setAttribute("aria-pressed", String(active));
		});
		document.querySelectorAll("[data-cv-link]").forEach((link) => {
			link.setAttribute("href", current === "zh" ? link.dataset.cvZh : link.dataset.cvEn);
			link.setAttribute("hreflang", current === "zh" ? "zh-CN" : "en");
		});
		document.title = current === "zh" ? "陈俊乐 | 笔记、随记与研究" : "Junle Chen | Notes, Memos, Research";
		if (persist) {
			try { window.localStorage.setItem(storageKey, current); } catch (error) { /* Storage is optional. */ }
			const url = new URL(window.location.href);
			url.searchParams.set("lang", current);
			window.history.replaceState(window.history.state, "", url.href);
		}
		document.dispatchEvent(new CustomEvent("junle:languagechange", { detail: { language: current } }));
	}

	window.JunleLanguage = { get current() { return current; }, set: (language) => apply(language, true) };
	document.querySelectorAll("[data-language]").forEach((button) => {
		button.addEventListener("click", () => apply(button.dataset.language, true));
	});
	apply(preferredLanguage(), false);
})();
