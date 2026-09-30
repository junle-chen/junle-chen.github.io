const assert = require("assert/strict");

const datePagination = require("../src/js/date-pagination.js");

const dates = [
	"2026-07-09",
	"2026-07-08",
	"2026-07-07",
	"2026-07-06",
	"2026-07-04",
	"2026-07-02",
	"2026-06-30",
	"2026-06-29",
	"2026-06-26",
	"2026-06-25",
	"2026-06-24",
];

const firstPage = datePagination.paginateDates(dates, 0, 5);
assert.deepEqual(firstPage.items, dates.slice(0, 5));
assert.equal(firstPage.pageNumber, 1);
assert.equal(firstPage.totalPages, 3);
assert.equal(firstPage.canPrevious, false);
assert.equal(firstPage.canNext, true);
assert.equal(firstPage.showPagination, true);

const lastPage = datePagination.paginateDates(dates, 99, 5);
assert.deepEqual(lastPage.items, dates.slice(10));
assert.equal(lastPage.pageNumber, 3);
assert.equal(lastPage.canPrevious, true);
assert.equal(lastPage.canNext, false);

const onlyPage = datePagination.paginateDates(dates.slice(0, 5), 0, 5);
assert.equal(onlyPage.totalPages, 1);
assert.equal(onlyPage.showPagination, false);

assert.equal(datePagination.findDatePage(dates, "2026-07-02", 5), 1);
assert.equal(datePagination.findDatePage(dates, "missing", 5), 0);

console.log("ok - Daily Paper date pagination");
