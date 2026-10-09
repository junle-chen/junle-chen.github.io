(() => {
	const root = document.querySelector("[data-cat-companion]");
	if (!root) return;
	const panel = root.querySelector("[data-cat-panel]");
	const pet = root.querySelector("[data-cat-pet]");
	const play = root.querySelector("[data-cat-play]");
	const nap = root.querySelector("[data-cat-nap]");
	const hide = root.querySelector("[data-cat-hide]");
	const restore = root.querySelector("[data-cat-restore]");
	const status = root.querySelector("[data-cat-status]");
	const menu = root.querySelector("[data-cat-menu]");
	const controls = root.querySelector("#mochi-controls");
	const side = root.querySelector("[data-cat-side]");
	const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const storageKey = "junle.homepage.mochi.hidden";
	const sideKey = "junle.homepage.mochi.side";
	let timer;
	let frame;
	let pointer;
	const setMenu = value => {
		controls.hidden = !value;
		menu.setAttribute("aria-expanded", String(value));
		menu.setAttribute("aria-label", value ? "Hide cat controls" : "Show cat controls");
	};
	const setSide = value => {
		root.dataset.side = value;
		const next = value === "right" ? "left" : "right";
		side.textContent = `Move ${next}`;
		side.setAttribute("aria-label", `Move Mochi to ${next} side`);
	};

	const setState = (state, message) => {
		window.clearTimeout(timer);
		root.dataset.state = state;
		status.textContent = message;
		const asleep = state === "sleeping";
		nap.textContent = asleep ? "Wake" : "Nap";
		nap.setAttribute("aria-pressed", String(asleep));
		pet.setAttribute("aria-label", asleep ? "Wake Mochi with a pet" : "Pet Mochi");
	};
	const idle = () => setState("idle", "Happy to keep you company.");
	const rememberHidden = value => {
		try { window.localStorage.setItem(storageKey, String(value)); } catch (error) { /* Optional preference storage. */ }
	};
	const setHidden = (value, focus) => {
		setMenu(false);
		root.classList.toggle("is-hidden", value);
		panel.hidden = value;
		restore.hidden = !value;
		root.classList.toggle("is-paused", value || document.hidden);
		if (value) { window.clearTimeout(timer); window.cancelAnimationFrame(frame); frame = null; }
		else idle();
		if (focus) (value ? restore : pet).focus();
	};
	pet.addEventListener("click", () => {
		setMenu(true);
		setState("happy", "Purr... that feels lovely!");
		timer = window.setTimeout(idle, 1900);
	});
	play.addEventListener("click", () => {
		setState("playing", "My favourite little yarn ball!");
		timer = window.setTimeout(idle, 2500);
	});
	nap.addEventListener("click", () => {
		if (root.dataset.state === "sleeping") idle();
		else setState("sleeping", "A tiny nap. Wake me anytime.");
	});
	hide.addEventListener("click", () => { setHidden(true, true); rememberHidden(true); });
	restore.addEventListener("click", () => { setHidden(false, true); rememberHidden(false); });
	menu.addEventListener("click", () => setMenu(controls.hidden));
	side.addEventListener("click", () => {
		setSide(root.dataset.side === "right" ? "left" : "right");
		try { window.localStorage.setItem(sideKey, root.dataset.side); } catch (error) { /* Optional preference storage. */ }
		setMenu(false);
		pet.focus();
	});
	document.addEventListener("pointerdown", event => { if (!root.contains(event.target)) setMenu(false); });
	root.addEventListener("keydown", event => { if (event.key === "Escape") { setMenu(false); menu.focus(); } });

	const updateMotion = () => root.classList.toggle("is-calm", motion.matches);
	updateMotion();
	if (motion.addEventListener) motion.addEventListener("change", updateMotion);
	document.addEventListener("visibilitychange", () => root.classList.toggle("is-paused", panel.hidden || document.hidden));
	document.addEventListener("pointermove", event => {
		if (event.pointerType !== "mouse" || motion.matches || panel.hidden || document.hidden) return;
		const rect = pet.getBoundingClientRect();
		if (rect.width === 0 || rect.bottom < 0 || rect.top > window.innerHeight) return;
		pointer = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
		if (frame) return;
		frame = window.requestAnimationFrame(() => {
			frame = null;
			root.style.setProperty("--cat-look-x", `${Math.max(-2.5, Math.min(2.5, pointer.x / 90))}px`);
			root.style.setProperty("--cat-look-y", `${Math.max(-1.8, Math.min(1.8, pointer.y / 90))}px`);
		});
	}, { passive: true });
	setSide("right");
	try {
		if (window.localStorage.getItem(sideKey) === "left") setSide("left");
		if (window.localStorage.getItem(storageKey) === "true") setHidden(true, false);
	} catch (error) { /* Storage may be disabled. */ }
})();
