/* Window-edge choreography. Painted cat rectangles must stay clear of page content. */
window.createCatPlayground = (root, options) => {
	const main = root.closest(".content-main");
	const toggle = root.querySelector("[data-cat-explore]");
	const size = 64, headHeight = 46;
	let enabled = true, dirty = true, obstacles = [], scannedAt = 0;
	let timer, transition, animation, generation = 0, active = null, lastWindow = null;
	try { enabled = localStorage.getItem("junle.homepage.mochi.explore") !== "false"; } catch (error) { /* Optional preference. */ }
	const viewport = () => ({ width: main.clientWidth || innerWidth, height: innerHeight });
	const rect = (x, y, width, height = width) => ({ left: x, top: y, right: x + width, bottom: y + height, width, height });
	const intersects = (a, b, gap = 4) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
	const scan = () => {
		const view = viewport();
		obstacles = [];
		const keep = box => { if (box.width > 0 && box.height > 0 && box.right > 0 && box.left < view.width && box.bottom > 0 && box.top < view.height) obstacles.push(box); };
		const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
		const range = document.createRange();
		let node;
		while ((node = walker.nextNode())) {
			if (!node.textContent.trim() || root.contains(node)) continue;
			range.selectNodeContents(node);
			Array.from(range.getClientRects()).forEach(keep);
		}
		main.querySelectorAll("img, input, button, select, textarea, iframe, video, svg, [role='dialog']").forEach(element => {
			if (!root.contains(element)) keep(element.getBoundingClientRect());
		});
		dirty = false;
		scannedAt = performance.now();
		root.style.setProperty("--cat-scrollbar", `${Math.max(0, innerWidth - view.width)}px`);
	};
	const clear = box => {
		if (dirty || performance.now() - scannedAt > 1200) scan();
		const view = viewport();
		return box.left >= 4 && box.right <= view.width - 4 && box.top >= 18 && box.bottom <= view.height - 8 && !obstacles.some(item => intersects(box, item));
	};
	const point = (x, y) => {
		root.style.setProperty("--cat-roam-x", `${x}px`);
		root.style.top = `${y}px`;
		root.style.bottom = "auto";
	};
	const park = () => {
		root.classList.remove("is-exploring", "is-peeking");
		root.dataset.activity = "resting";
		delete root.dataset.window;
		options.dock();
		const box = root.getBoundingClientRect();
		if (clear(box)) return true;
		const view = viewport();
		const candidates = [];
		for (let y = 64; y <= view.height - box.height - 16; y += 16) candidates.push(y);
		candidates.sort((a, b) => Math.abs(a - box.top) - Math.abs(b - box.top));
		const safe = candidates.find(y => clear(rect(box.left, y, box.width, box.height)));
		if (safe === undefined) return false;
		options.place(safe);
		return true;
	};
	const cancel = (dock = true) => {
		generation++;
		clearTimeout(timer);
		clearTimeout(transition);
		cancelAnimationFrame(animation);
		animation = null;
		const wasActive = active !== null || root.classList.contains("is-exploring");
		active = null;
		if (dock) {
			root.classList.add("is-tucked");
			const safe = park();
			if (wasActive) options.pose("idle", "Your little research companion.");
			if (safe) root.classList.remove("is-tucked");
		}
	};
	const eligible = () => enabled && !options.motion.matches && !options.paused() && !options.busy() && !root.matches(":hover") && !root.contains(document.activeElement) && ["idle", "curious"].includes(root.dataset.state);
	const arm = (delay = 5500 + Math.random() * 4500) => {
		clearTimeout(timer);
		if (!enabled || options.motion.matches || options.paused()) return;
		timer = setTimeout(() => { if (eligible()) tour(); else arm(2500); }, delay);
	};
	const peekPoints = element => {
		const box = element.getBoundingClientRect();
		const right = root.dataset.side === "right";
		const corners = [
			{ x: box.right - size - 12, y: box.top - headHeight + 2 },
			{ x: box.left + 12, y: box.top - headHeight + 2 }
		];
		if (!right) corners.reverse();
		const outside = [
			{ x: box.right - 16, y: box.top + 12 },
			{ x: box.left - size + 16, y: box.top + 12 },
			{ x: box.right + 4, y: box.top + 12 },
			{ x: box.left - size - 4, y: box.top + 12 }
		];
		return corners.concat(right ? outside : [outside[1], outside[0], outside[3], outside[2]]).filter(p => clear(rect(p.x, p.y, size, headHeight)));
	};
	const windows = () => {
		const view = viewport();
		const cards = Array.from(main.querySelectorAll(".workspace-topbar, .info-card, .about-workspace-card, .memo-entry, .note-card-shell, .rail-panel, .academic-control-card, .academic-section, .bookmark-card, .note-article"));
		return cards.filter(element => {
			const box = element.getBoundingClientRect();
			return box.width > 80 && box.height > 50 && box.top >= 32 && box.top < view.height - headHeight - 12 && peekPoints(element).length;
		}).sort(() => Math.random() - .5).sort((a, b) => Number(a === lastWindow) - Number(b === lastWindow));
	};
	const climbPath = element => {
		const box = element.getBoundingClientRect(), view = viewport();
		const endY = Math.max(64, Math.min(view.height - size - 16, box.top + 10));
		const startY = Math.min(view.height - size - 16, endY + Math.min(150, Math.max(60, box.height - size - 16)));
		const edges = root.dataset.side === "right" ? [box.right - 8, box.left - size + 8, box.right + 4, box.left - size - 4] : [box.left - size + 8, box.right - 8, box.left - size - 4, box.right + 4];
		const x = edges.find(value => clear(rect(value, endY, size, startY - endY + size)));
		return x === undefined || startY - endY < 20 ? null : { x, startY, endY, wall: x > box.left + box.width / 2 ? "left" : "right" };
	};
	const retreat = () => { cancel(true); arm(); };
	const revealPeek = (element, token) => {
		if (token !== generation) return;
		const candidate = peekPoints(element)[0];
		if (!candidate || options.paused() || options.busy()) { retreat(); return; }
		root.classList.add("is-tucked");
		transition = setTimeout(() => {
			if (token !== generation) return;
			root.classList.add("is-exploring", "is-peeking");
			point(candidate.x, candidate.y);
			active = { element, kind: "peek" };
			root.dataset.activity = "peeking";
			options.pose("peeking", "Hello from this window!");
			if (!clear(root.getBoundingClientRect())) { retreat(); return; }
			root.classList.remove("is-tucked");
			lastWindow = element;
			transition = setTimeout(retreat, 3300);
		}, 180);
	};
	const tour = () => {
		const element = windows()[0];
		if (!element) { arm(3500); return; }
		const path = climbPath(element);
		const token = ++generation;
		active = { element, kind: "climb" };
		root.dataset.window = (element.querySelector("h2, h3, h4")?.textContent || element.getAttribute("aria-label") || "Window").trim().slice(0, 80);
		root.classList.add("is-tucked");
		root.querySelector("[data-cat-bubble]").hidden = true;
		transition = setTimeout(() => {
			if (token !== generation || options.paused() || options.busy()) { retreat(); return; }
			if (!path) { revealPeek(element, token); return; }
			root.classList.add("is-exploring");
			root.classList.remove("is-peeking");
			point(path.x, path.startY);
			root.dataset.activity = "climbing";
			root.dataset.wall = path.wall;
			options.pose("climbing", "A little climb up the window...");
			root.classList.remove("is-tucked");
			let y = path.startY, last = performance.now();
			const step = time => {
				if (token !== generation) return;
				if (options.paused() || options.busy()) { retreat(); return; }
				y = Math.max(path.endY, y - Math.min((time - last) / 1000, .05) * 80);
				last = time;
				if (!clear(rect(path.x, y, size))) { retreat(); return; }
				point(path.x, y);
				if (y <= path.endY) { animation = null; revealPeek(element, token); }
				else animation = requestAnimationFrame(step);
			};
			if (!clear(root.getBoundingClientRect())) { retreat(); return; }
			animation = requestAnimationFrame(step);
		}, 180);
	};
	const invalidate = () => {
		dirty = true;
		if (active?.kind === "peek") {
			const candidate = peekPoints(active.element)[0];
			if (candidate) point(candidate.x, candidate.y); else { retreat(); return; }
		}
		if (active && !clear(root.getBoundingClientRect())) retreat();
		else if (!active && !options.busy() && !root.classList.contains("is-dragging")) {
			if (park()) root.classList.remove("is-tucked"); else root.classList.add("is-tucked");
		}
	};
	const observer = new MutationObserver(records => {
		if (records.some(record => !root.contains(record.target) || (record.target === root && record.attributeName === "data-side"))) invalidate();
	});
	observer.observe(main, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden", "style", "data-side"] });
	if (window.ResizeObserver) new ResizeObserver(invalidate).observe(main.querySelector(".app-shell"));
	main.addEventListener("scroll", () => { if (active?.kind === "climb") retreat(); invalidate(); }, { passive: true });
	window.addEventListener("hashchange", () => { dirty = true; cancel(true); arm(2200); });
	window.addEventListener("resize", () => { dirty = true; cancel(true); arm(2200); });
	if (document.fonts) document.fonts.ready.then(invalidate);
	const label = () => { toggle.textContent = enabled ? "Stay here" : "Explore windows"; toggle.setAttribute("aria-pressed", String(enabled)); };
	toggle.addEventListener("click", () => {
		enabled = !enabled;
		try { localStorage.setItem("junle.homepage.mochi.explore", String(enabled)); } catch (error) { /* Optional preference. */ }
		label();
		cancel(true);
		if (enabled) arm(1200);
	});
	label();
	scan();
	invalidate();
	arm(4500);
	return {
		isClear: clear,
		pause: (dock = true) => { cancel(dock); if (dock) arm(10000); },
		resume: (delay = 3000) => { if (root.classList.contains("is-exploring")) cancel(true); arm(delay); },
		sync: () => { cancel(true); arm(4500); }
	};
};
