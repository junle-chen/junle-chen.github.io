(() => {
	const root = document.querySelector("[data-cat-companion]");
	if (!root) return;
	const find = name => root.querySelector(`[data-cat-${name}]`);
	const panel = find("panel"), pet = find("pet"), sprite = find("sprite");
	const menu = find("menu"), controls = root.querySelector("#mochi-controls");
	const nap = find("nap"), side = find("side"), follow = find("follow");
	const status = find("status"), bubble = find("bubble"), restore = find("restore");
	const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const prefix = "junle.homepage.mochi.";
	const poses = { idle: [0, 0, 0, 0, 0, 0, 1], happy: [4, 5], walking: [2, 3], jumping: [6, 7], playing: [8, 9], sleeping: [10, 11], feeding: [12, 13], curious: [14, 15] };
	let phase = 0, actionTimer, bubbleTimer, poseTimer, wanderTimer, movement;
	let targetY, lastTime, drag, ignoreClick = false, following = false;
	let position = 1;
	const save = (key, value) => { try { localStorage.setItem(prefix + key, String(value)); } catch (error) { /* Preferences are optional. */ } };
	const load = key => { try { return localStorage.getItem(prefix + key); } catch (error) { return null; } };
	const paused = () => panel.hidden || document.hidden;
	const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
	const bounds = () => ({ min: 64, max: Math.max(64, window.innerHeight - root.offsetWidth - 16) });
	const place = y => {
		const range = bounds();
		const top = clamp(y, range.min, range.max);
		root.style.top = `${top}px`;
		root.style.bottom = "auto";
		position = range.max === range.min ? 1 : (top - range.min) / (range.max - range.min);
		if (!controls.hidden) placeMenu();
	};
	const placeMenu = () => {
		const rect = root.getBoundingClientRect();
		const top = clamp(rect.top, 8, Math.max(8, window.innerHeight - controls.offsetHeight - 8));
		controls.style.top = `${top - rect.top}px`;
	};
	const setMenu = value => {
		controls.hidden = !value;
		menu.setAttribute("aria-expanded", String(value));
		menu.setAttribute("aria-label", value ? "Hide cat controls" : "Show cat controls");
		if (value) { bubble.hidden = true; stopMovement(); placeMenu(); }
	};
	const setSide = value => {
		root.dataset.side = value;
		root.dataset.facing = value === "left" ? "right" : "left";
		const next = value === "left" ? "right" : "left";
		side.textContent = `Move ${next}`;
		side.setAttribute("aria-label", `Move Mochi to ${next} side`);
	};
	const renderPose = () => {
		const frames = poses[root.dataset.state] || poses.idle;
		const frame = frames[(motion.matches ? 0 : phase++) % frames.length];
		sprite.style.backgroundPosition = `${(frame % 4) * 100 / 3}% ${Math.floor(frame / 4) * 100 / 3}%`;
		sprite.dataset.frame = String(frame);
	};
	const setState = (state, message, duration) => {
		clearTimeout(actionTimer);
		root.dataset.state = state;
		phase = 0;
		status.textContent = message;
		const asleep = state === "sleeping";
		nap.textContent = asleep ? "Wake" : "Nap";
		nap.setAttribute("aria-pressed", String(asleep));
		pet.setAttribute("aria-label", asleep ? "Wake Mochi with a pet" : "Pet Mochi");
		renderPose();
		if (duration) actionTimer = setTimeout(idle, duration);
	};
	const idle = () => setState("idle", "Your little research companion.");
	const speak = message => {
		clearTimeout(bubbleTimer);
		bubble.textContent = message;
		bubble.hidden = !controls.hidden || root.getBoundingClientRect().top < 150;
		bubbleTimer = setTimeout(() => { bubble.hidden = true; }, 2400);
	};
	const stopMovement = () => {
		cancelAnimationFrame(movement);
		movement = null;
		targetY = null;
		if (root.dataset.state === "walking") idle();
	};
	const step = time => {
		if (paused() || drag || targetY === null || !controls.hidden) { stopMovement(); return; }
		const delta = targetY - root.getBoundingClientRect().top;
		const amount = Math.min(Math.abs(delta), Math.min((time - lastTime) / 1000, .05) * 95);
		lastTime = time;
		place(root.getBoundingClientRect().top + Math.sign(delta) * amount);
		if (Math.abs(delta) < 2) {
			movement = null;
			targetY = null;
			setState(following ? "curious" : "idle", following ? "I am following your cursor!" : "Your little research companion.");
			return;
		}
		movement = requestAnimationFrame(step);
	};
	const moveTo = y => {
		const range = bounds();
		targetY = clamp(y, range.min, range.max);
		if (motion.matches) { place(targetY); targetY = null; return; }
		if (!movement) {
			setState("walking", following ? "Catch me if you can!" : "A little stretch...");
			lastTime = performance.now();
			movement = requestAnimationFrame(step);
		}
	};
	const setFollow = value => {
		following = value;
		follow.textContent = value ? "Stop following" : "Follow cursor";
		follow.setAttribute("aria-pressed", String(value));
		if (!value) stopMovement();
	};
	const act = (state, message, duration) => {
		stopMovement();
		setState(state, message, duration);
		setMenu(false);
		speak(message);
	};
	const updateActivity = () => {
		clearInterval(poseTimer);
		clearTimeout(wanderTimer);
		root.classList.toggle("is-paused", paused());
		root.classList.toggle("is-calm", motion.matches);
		if (paused()) { stopMovement(); return; }
		renderPose();
		if (motion.matches) { stopMovement(); return; }
		poseTimer = setInterval(renderPose, 260);
		const wander = () => {
			if (!following && !drag && controls.hidden && root.dataset.state === "idle") moveTo(root.getBoundingClientRect().top + (Math.random() - .5) * 100);
			wanderTimer = setTimeout(wander, 14000 + Math.random() * 10000);
		};
		wanderTimer = setTimeout(wander, 18000);
	};
	const setHidden = (value, focus) => {
		setMenu(false);
		root.classList.toggle("is-hidden", value);
		panel.hidden = value;
		restore.hidden = !value;
		bubble.hidden = true;
		setFollow(false);
		if (value) { clearTimeout(actionTimer); clearTimeout(bubbleTimer); } else idle();
		updateActivity();
		if (focus) (value ? restore : pet).focus();
	};
	pet.addEventListener("click", event => {
		if (ignoreClick) { ignoreClick = false; return; }
		if (event.detail < 2) act("happy", "Purr... thank you!", 1800);
	});
	pet.addEventListener("dblclick", () => act("jumping", "Boing!", 900));
	pet.addEventListener("contextmenu", event => { event.preventDefault(); setMenu(true); });
	find("feed").addEventListener("click", () => act("feeding", "A fish for me? Yum!", 2300));
	find("play").addEventListener("click", () => act("playing", "My favourite yarn ball!", 2800));
	find("jump").addEventListener("click", () => act("jumping", "Boing!", 900));
	nap.addEventListener("click", () => { setFollow(false); if (root.dataset.state === "sleeping") act("happy", "Good morning!", 1500); else act("sleeping", "A tiny nap. Zzz..."); });
	follow.addEventListener("click", () => { setFollow(!following); if (following) idle(); setMenu(false); speak(following ? "Move your cursor. I will follow!" : "Time for a rest."); });
	menu.addEventListener("click", () => setMenu(controls.hidden));
	find("hide").addEventListener("click", () => { setHidden(true, true); save("hidden", true); });
	restore.addEventListener("click", () => { setHidden(false, true); save("hidden", false); });
	side.addEventListener("click", () => { stopMovement(); setSide(root.dataset.side === "left" ? "right" : "left"); save("side", root.dataset.side); setMenu(false); pet.focus(); });
	pet.addEventListener("pointerdown", event => {
		if (event.button !== 0 || !event.isPrimary) return;
		stopMovement();
		const rect = root.getBoundingClientRect();
		drag = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, moved: false };
		pet.setPointerCapture(event.pointerId);
	});
	pet.addEventListener("pointermove", event => {
		if (!drag || event.pointerId !== drag.id) return;
		if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
		drag.moved = true;
		setMenu(false);
		root.classList.add("is-dragging");
		root.style.setProperty("--cat-drag-x", `${clamp(event.clientX - drag.offsetX, 4, window.innerWidth - root.offsetWidth - 4)}px`);
		place(event.clientY - drag.offsetY);
		setState("curious", "Where are we going?");
	});
	const endDrag = event => {
		if (!drag || event.pointerId !== drag.id) return;
		if (drag.moved) {
			ignoreClick = true;
			setTimeout(() => { ignoreClick = false; }, 0);
			setSide(root.getBoundingClientRect().left + root.offsetWidth / 2 < window.innerWidth / 2 ? "left" : "right");
			save("side", root.dataset.side);
			save("position", position);
			idle();
		}
		drag = null;
		root.classList.remove("is-dragging");
	};
	pet.addEventListener("pointerup", endDrag);
	pet.addEventListener("pointercancel", endDrag);
	pet.addEventListener("lostpointercapture", endDrag);
	pet.addEventListener("keydown", event => {
		if (!/^Arrow/.test(event.key)) return;
		event.preventDefault();
		stopMovement();
		if (event.key === "ArrowLeft" || event.key === "ArrowRight") { setSide(event.key === "ArrowLeft" ? "left" : "right"); save("side", root.dataset.side); }
		else { place(root.getBoundingClientRect().top + (event.key === "ArrowUp" ? -36 : 36)); save("position", position); }
	});
	root.addEventListener("keydown", event => { if (event.key === "Escape") { setMenu(false); menu.focus(); } });
	root.addEventListener("pointerenter", stopMovement);
	document.addEventListener("pointerdown", event => { if (!root.contains(event.target)) setMenu(false); });
	document.addEventListener("pointermove", event => {
		if (event.pointerType !== "mouse" || paused() || drag || !controls.hidden || root.contains(event.target)) return;
		root.dataset.facing = event.clientX < root.getBoundingClientRect().left ? "left" : "right";
		if (following && ["idle", "walking", "curious"].includes(root.dataset.state)) moveTo(event.clientY - root.offsetWidth / 2);
	}, { passive: true });
	window.addEventListener("resize", () => { stopMovement(); const range = bounds(); place(range.min + position * (range.max - range.min)); });
	document.addEventListener("visibilitychange", updateActivity);
	if (motion.addEventListener) motion.addEventListener("change", updateActivity);
	setSide(load("side") === "left" ? "left" : "right");
	const savedPosition = load("position");
	if (savedPosition !== null && Number.isFinite(Number(savedPosition))) position = clamp(Number(savedPosition), 0, 1);
	const range = bounds();
	place(range.min + position * (range.max - range.min));
	setHidden(load("hidden") === "true", false);
})();
