(function (root, factory) {
	const api = factory();
	if (typeof module === "object" && module.exports) {
		module.exports = api;
	}
	if (root) {
		root.HomepageDatePagination = api;
	}
})(typeof window !== "undefined" ? window : globalThis, function () {
	function normalizePageSize(pageSize) {
		return Math.max(1, Number(pageSize) || 5);
	}

	function paginateDates(dates, requestedPage, pageSize) {
		const items = Array.isArray(dates) ? dates : [];
		const size = normalizePageSize(pageSize);
		const totalPages = Math.max(1, Math.ceil(items.length / size));
		const pageIndex = Math.min(Math.max(0, Number(requestedPage) || 0), totalPages - 1);

		return {
			items: items.slice(pageIndex * size, (pageIndex + 1) * size),
			pageIndex,
			pageNumber: pageIndex + 1,
			totalPages,
			canPrevious: pageIndex > 0,
			canNext: pageIndex < totalPages - 1,
			showPagination: totalPages > 1,
		};
	}

	function findDatePage(dates, selectedDate, pageSize) {
		const index = Array.isArray(dates) ? dates.indexOf(selectedDate) : -1;
		return index < 0 ? 0 : Math.floor(index / normalizePageSize(pageSize));
	}

	return { paginateDates, findDatePage };
});
