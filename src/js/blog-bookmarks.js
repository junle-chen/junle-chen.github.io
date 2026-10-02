(function () {
	"use strict";

	function normalizeUrl(value) {
		var url = new URL(String(value || "").trim());
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new Error("请输入 http 或 https 网页链接");
		}
		url.hash = "";
		return url.toString();
	}

	function text(value) {
		return String(value == null ? "" : value).trim();
	}

	function element(tag, className, content) {
		var node = document.createElement(tag);
		if (className) node.className = className;
		if (content != null) node.textContent = String(content);
		return node;
	}

	function bindBlogBookmarks() {
		var store = window.JunleRealtime;
		var config = window.JUNLE_REALTIME_CONFIG || {};
		var section = document.querySelector("[data-bookmark-workspace]");
		if (!store || !section) return;

		var locked = document.querySelector("[data-bookmark-locked]");
		var lockMessage = document.querySelector("[data-bookmark-lock-message]");
		var loginButton = document.querySelector("[data-bookmark-login]");
		var logoutButton = document.querySelector("[data-bookmark-logout]");
		var signoutButton = document.querySelector("[data-bookmark-signout]");
		var form = document.querySelector("[data-bookmark-form]");
		var formTitle = document.querySelector("[data-bookmark-form-title]");
		var importButton = document.querySelector("[data-bookmark-import]");
		var cancelButton = document.querySelector("[data-bookmark-cancel]");
		var saveButton = document.querySelector("[data-bookmark-save]");
		var searchInput = document.querySelector("[data-bookmark-search]");
		var countNode = document.querySelector("[data-bookmark-count]");
		var categoriesNode = document.querySelector("[data-bookmark-categories]");
		var categoryOptions = document.querySelector("[data-bookmark-category-options]");
		var categoryFrom = document.querySelector("[data-bookmark-category-from]");
		var categoryTo = document.querySelector("[data-bookmark-category-to]");
		var renameButton = document.querySelector("[data-bookmark-rename]");
		var statusNode = document.querySelector("[data-bookmark-status]");
		var listNode = document.querySelector("[data-bookmark-list]");
		var emptyNode = document.querySelector("[data-bookmark-empty]");
		var items = [];
		var activeCategory = "";
		var loadedForUser = "";
		var busy = false;

		function setStatus(message, isError) {
			statusNode.textContent = message || "";
			statusNode.classList.toggle("is-error", Boolean(isError));
		}

		function getClient() {
			return typeof store.getClient === "function" ? store.getClient() : null;
		}

		function isOwner() {
			var auth = store.getAuthState();
			var ids = Array.isArray(config.ownerSupabaseUserIds) ? config.ownerSupabaseUserIds : [];
			return Boolean(auth.owner && auth.user && ids.indexOf(auth.user.id) !== -1);
		}

	function setBusy(next) {
		busy = next;
		saveButton.disabled = next;
		importButton.disabled = next;
		renameButton.disabled = next || !sortedCategories().length;
		}

		function resetForm() {
			form.reset();
			form.dataset.editId = "";
			formTitle.textContent = "Add a blog";
			saveButton.textContent = "Save blog";
			cancelButton.hidden = true;
		}

		function sortedCategories() {
			return Array.from(new Set(items.map(function (item) {
				return text(item.category) || "未分类";
			}))).sort(function (a, b) {
				return a.localeCompare(b, "zh-CN");
			});
		}

		function renderCategories() {
			var categories = sortedCategories();
			var previous = categoryFrom.value;
			categoriesNode.replaceChildren();
			categoryOptions.replaceChildren();
			categoryFrom.replaceChildren();

			function addFilter(label, value, count) {
				var button = element("button", value === activeCategory ? "is-active" : "", label + " " + count);
				button.type = "button";
				button.addEventListener("click", function () {
					activeCategory = value;
					render();
				});
				categoriesNode.appendChild(button);
			}

			addFilter("All", "", items.length);
			categories.forEach(function (category) {
				var count = items.filter(function (item) { return item.category === category; }).length;
				addFilter(category, category, count);
				var option = document.createElement("option");
				option.value = category;
				categoryOptions.appendChild(option);
				var selectOption = element("option", "", category);
				selectOption.value = category;
				categoryFrom.appendChild(selectOption);
			});
			categoryFrom.value = categories.indexOf(previous) !== -1 ? previous : categories[0] || "";
			renameButton.disabled = busy || !categories.length;
		}

		function renderItem(item) {
			var card = element("article", "bookmark-card");
			var heading = element("div", "bookmark-card-heading");
			var title = element("a", "bookmark-card-title", item.title);
			title.href = item.url;
			title.target = "_blank";
			title.rel = "noopener noreferrer";
			heading.appendChild(title);
			heading.appendChild(element("span", "bookmark-card-category", item.category || "未分类"));
			card.appendChild(heading);
			if (item.summary) card.appendChild(element("p", "bookmark-card-summary", item.summary));
			var meta = element("div", "bookmark-card-meta");
			var host = item.url;
			try { host = new URL(item.url).hostname; } catch (error) { /* Keep the saved URL visible. */ }
			meta.appendChild(element("span", "", host));
			meta.appendChild(element("span", "", item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ""));
			card.appendChild(meta);
			var actions = element("div", "bookmark-card-actions");
			var edit = element("button", "", "Edit");
			edit.type = "button";
			edit.addEventListener("click", function () {
				form.elements.url.value = item.url;
				form.elements.title.value = item.title;
				form.elements.summary.value = item.summary || "";
				form.elements.category.value = item.category || "";
				form.dataset.editId = item.id;
				formTitle.textContent = "Edit saved blog";
				saveButton.textContent = "Save changes";
				cancelButton.hidden = false;
				form.scrollIntoView({ behavior: "smooth", block: "start" });
			});
			var remove = element("button", "is-danger", "Delete");
			remove.type = "button";
			remove.addEventListener("click", function () { removeItem(item); });
			actions.appendChild(edit);
			actions.appendChild(remove);
			card.appendChild(actions);
			return card;
		}

		function render() {
			var query = text(searchInput.value).toLowerCase();
			var visible = items.filter(function (item) {
				if (activeCategory && item.category !== activeCategory) return false;
				return !query || [item.title, item.summary, item.url, item.category]
					.join(" ").toLowerCase().indexOf(query) !== -1;
			});
			countNode.textContent = items.length + " saved";
			renderCategories();
			listNode.replaceChildren();
			visible.forEach(function (item) { listNode.appendChild(renderItem(item)); });
			emptyNode.hidden = visible.length > 0;
			emptyNode.textContent = items.length ? "No blogs match this view." : "No saved blogs yet. Add the first link above.";
		}

		function loadItems() {
			var client = getClient();
			if (!client || !isOwner()) return Promise.resolve();
			setStatus("Loading private blogs...");
			return client.from("site_blog_bookmarks")
				.select("id,url,title,summary,category,created_at,updated_at")
				.order("updated_at", { ascending: false })
				.then(function (result) {
					if (result.error) throw result.error;
					if (!isOwner()) return;
					items = result.data || [];
					loadedForUser = store.getAuthState().user.id;
					setStatus("");
					render();
				})
				.catch(function (error) {
					if (!isOwner()) return;
					setStatus("无法读取收藏：" + (error.message || "请检查数据库配置"), true);
				});
		}

		function renderAuth() {
			var auth = store.getAuthState();
			var owner = isOwner();
			locked.hidden = owner;
			section.hidden = !owner;
			loginButton.hidden = Boolean(auth.user) || !auth.enabled;
			logoutButton.hidden = !auth.user;
			if (!owner) {
				items = [];
				loadedForUser = "";
				activeCategory = "";
				listNode.replaceChildren();
				resetForm();
				lockMessage.textContent = !auth.enabled
					? "Private library is unavailable until Supabase is configured."
					: auth.user
						? "This GitHub account is not the site owner. Sign out and use the owner account."
						: "Sign in with your GitHub owner account to open this private collection.";
					return;
			}
			if (loadedForUser !== auth.user.id) loadItems();
		}

		function removeItem(item) {
			if (!isOwner() || busy || !window.confirm("Delete this saved blog?")) return;
			setBusy(true);
			getClient().from("site_blog_bookmarks").delete().eq("id", item.id).select("id").single()
				.then(function (result) {
					if (result.error) throw result.error;
					if (form.dataset.editId === item.id) resetForm();
					return loadItems();
				})
				.catch(function (error) { setStatus("删除失败：" + error.message, true); })
				.finally(function () { setBusy(false); });
		}

		form.addEventListener("submit", function (event) {
			event.preventDefault();
			if (!isOwner() || busy) return;
			var url;
			try {
				url = normalizeUrl(form.elements.url.value);
			} catch (error) {
				setStatus(error.message, true);
				return;
			}
			var record = {
				url: url,
				title: text(form.elements.title.value),
				summary: text(form.elements.summary.value),
				category: text(form.elements.category.value) || "未分类",
			};
			if (!record.title) {
				setStatus("请输入标题", true);
				return;
			}
			setBusy(true);
			var query = form.dataset.editId
				? getClient().from("site_blog_bookmarks").update(record).eq("id", form.dataset.editId)
				: getClient().from("site_blog_bookmarks").insert(record);
			query.select("id").single().then(function (result) {
				if (result.error) throw result.error;
				resetForm();
				return loadItems();
			}).catch(function (error) {
				setStatus(error.code === "23505" ? "这个链接已收藏，可编辑已有条目。" : "保存失败：" + error.message, true);
			}).finally(function () { setBusy(false); });
		});

		importButton.addEventListener("click", function () {
			if (!isOwner() || busy) return;
			var url;
			try {
				url = normalizeUrl(form.elements.url.value);
			} catch (error) {
				setStatus(error.message, true);
				return;
			}
			if ((form.elements.title.value || form.elements.summary.value) &&
				!window.confirm("Replace the current title and summary with the webpage metadata?")) return;
			setBusy(true);
			setStatus("Reading webpage title and summary...");
			getClient().functions.invoke("blog-metadata", { body: { url: url } })
				.then(function (result) {
					if (result.error || !result.data || result.data.error) {
						throw result.error || new Error(result.data && result.data.error || "Metadata unavailable");
					}
					form.elements.title.value = result.data.title || "";
					form.elements.summary.value = result.data.summary || "";
					setStatus("网页信息已填写，可修改分类后保存。");
				})
				.catch(function () {
					setStatus("网页信息无法自动读取；请手动填写标题和摘要。", true);
				})
				.finally(function () { setBusy(false); });
		});

		renameButton.addEventListener("click", function () {
			if (!isOwner() || busy) return;
			var oldName = categoryFrom.value;
			var newName = text(categoryTo.value);
			if (!oldName || !newName || oldName === newName) {
				setStatus("请选择分类并输入不同的新名称", true);
				return;
			}
			if (!window.confirm("Move every blog in “" + oldName + "” to “" + newName + "”?")) return;
			setBusy(true);
			getClient().from("site_blog_bookmarks")
				.update({ category: newName }).eq("category", oldName).select("id")
				.then(function (result) {
					if (result.error) throw result.error;
					if (activeCategory === oldName) activeCategory = newName;
					categoryTo.value = "";
					return loadItems();
				})
				.catch(function (error) { setStatus("分类更新失败：" + error.message, true); })
				.finally(function () { setBusy(false); });
		});

		searchInput.addEventListener("input", render);
		cancelButton.addEventListener("click", resetForm);
		loginButton.addEventListener("click", function () {
			store.signIn().catch(function () { lockMessage.textContent = "登录未成功，请重试。"; });
		});
		[logoutButton, signoutButton].forEach(function (button) {
			button.addEventListener("click", function () { store.signOut(); });
		});
		store.on("auth", renderAuth);
		store.on("ready", renderAuth);
		store.init().then(renderAuth);
		renderAuth();
	}

	window.addEventListener("DOMContentLoaded", bindBlogBookmarks);
})();
