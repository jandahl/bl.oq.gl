import test from "node:test";
import assert from "node:assert/strict";
import { alignChainIds } from "../../docs/contrast-model.js";

test("alignChainIds matches shared API IDs in order and keeps insertions/deletions visible", () => {
	assert.deepEqual(alignChainIds(["root", "deriv", "ending"], ["root", "ending"]), [
		{ leftIndex: 0, rightIndex: 0, shared: true },
		{ leftIndex: 1, rightIndex: null, shared: false },
		{ leftIndex: 2, rightIndex: 1, shared: true },
	]);
	assert.deepEqual(alignChainIds(["a", "b"], ["x", "a", "c"]), [
		{ leftIndex: null, rightIndex: 0, shared: false },
		{ leftIndex: 0, rightIndex: 1, shared: true },
		{ leftIndex: 1, rightIndex: null, shared: false },
		{ leftIndex: null, rightIndex: 2, shared: false },
	]);
});

test("alignChainIds handles empty chains", () => {
	assert.deepEqual(alignChainIds([], ["root"]), [{ leftIndex: null, rightIndex: 0, shared: false }]);
	assert.deepEqual(alignChainIds([], []), []);
});
