import { test } from "node:test";
import assert from "node:assert/strict";
import { canvasIdTree, sameIdTree } from "../../docs/id-tree.js";

test("sameIdTree compares sentence/word/id trees without stringifying", () => {
	const tree = [[["qimmeq", "N_ABS"]], [["neri", "V_IND"]]];
	assert.equal(sameIdTree(tree, [[["qimmeq", "N_ABS"]], [["neri", "V_IND"]]]), true);
	assert.equal(sameIdTree(tree, [[["qimmeq", "N_ABS"]], [["neri", "V_IND", "extra"]]]), false);
	assert.equal(sameIdTree(tree, [[["qimmeq"]]]), false);
	assert.equal(sameIdTree(null, tree), false);
	assert.equal(sameIdTree([["not-nested"]], [[["qimmeq"]]]), false);
});

test("canvasIdTree drops held words and keeps drawable ids", () => {
	const tree = {
		sentences: [{
			words: [
				{ ids: ["qimmeq"], held: null },
				{ ids: ["ignored"], held: "not drawn" },
			],
		}],
	};
	assert.deepEqual(canvasIdTree(tree), [[["qimmeq"]]]);
	assert.deepEqual(canvasIdTree(null), []);
	assert.deepEqual(canvasIdTree({}), []);
});
