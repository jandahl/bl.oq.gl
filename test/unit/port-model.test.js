import test from "node:test";
import assert from "node:assert/strict";
import { classPorts } from "../../docs/port-model.js";
test("ports display supplied class metadata without guessing missing classes", () => {
	assert.deepEqual(classPorts({ category_shift: "N -> V" }), { input: "N", output: "V" });
	assert.deepEqual(classPorts({ category_shift: "V → N" }), { input: "V", output: "N" });
	assert.deepEqual(classPorts({ word_class: "N" }), { input: null, output: "N" });
	assert.deepEqual(classPorts({ inflection: { mood: "indicative" } }), { input: null, output: null });
	assert.deepEqual(classPorts({ category_shift: "unrecognized" }), { input: null, output: null });
});
