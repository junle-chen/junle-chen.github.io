const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mainJs = fs.readFileSync(path.join(__dirname, "..", "src/js/main.js"), "utf8");

function extractAddMemoFailureHandler(source) {
	const addMemoCall = "window.JunleRealtime.addMemo(memo)";
	const start = source.indexOf(addMemoCall);
	assert.notStrictEqual(start, -1, "memo form should call JunleRealtime.addMemo");

	const catchStart = source.indexOf(".catch", start);
	assert.notStrictEqual(catchStart, -1, "remote memo add should handle sync failures");

	const nextReturn = source.indexOf("\n\t\t\t\t\treturn;", catchStart);
	assert.notStrictEqual(nextReturn, -1, "remote memo add branch should end after its failure handler");
	return source.slice(catchStart, nextReturn);
}

const failureHandler = extractAddMemoFailureHandler(mainJs);

assert(
	!failureHandler.includes("saveLocalMemo()"),
	"failed remote memo writes must not silently fall back to localStorage"
);
assert(
	!failureHandler.includes("Saved locally"),
	"failed remote memo writes must show a sync/auth failure, not local success"
);

console.log("memo manager realtime failure behavior ok");
