import test from "node:test";
import assert from "node:assert/strict";
import { wordPresentation, editChain, editPlanChain, normalizeEditablePlan } from "../../docs/visualization-model.js";

test("missing IDs fail before engine calls and remain visible", () => {
	const engine = { buildWord() { throw new Error("must not call"); }, presentSequence() { throw new Error("must not call"); } };
	const word = wordPresentation(["known", "missing"], new Map([["known", { seq: [{}] }]]), {}, engine);
	assert.deepEqual(word.missing, ["missing"]);
	assert.match(word.error, /missing/);
	assert.equal(word.graph, null);
});
test("engine preserves all sequence items, approximation and open state", () => {
	const seq = [{ id: "a" }, { id: "zero", text: "" }];
	const raw = { by_id: {} }; const options = { lang: "da" };
	const word = wordPresentation(["a"], new Map([["a", { seq }]]), raw, {
		buildWord(items) { assert.deepEqual(items, seq); return { ok: true, word: "x", approximate: true, closed: false }; },
		presentSequence(items, catalog, opts) { assert.deepEqual(items, seq); assert.equal(catalog, raw); assert.equal(opts.engineOptions, options); assert.equal(opts.word, "x"); return { semantics: { verified: false } }; },
	}, options);
	assert.equal(word.built.approximate, true); assert.equal(word.built.closed, false);
});
test("invalid joins get no manufactured surface alignment", () => {
	const word = wordPresentation(["a"], new Map([["a", { seq: [{}] }]]), {}, { buildWord: () => ({ ok: false, reason: "wrong class" }), presentSequence: (_s, _c, options) => { assert.equal("word" in options, false); return {}; } });
	assert.equal(word.error, "wrong class");
});
test("card edits are ordered, immutable and bounded", () => {
	const ids = ["a", "b"];
	assert.deepEqual(editChain(ids, 1, "insert", "c"), ["a", "c", "b"]);
	assert.deepEqual(editChain(ids, 0, "right"), ["b", "a"]);
	assert.deepEqual(editChain(ids, 0, "left"), ids);
	assert.deepEqual(editChain(ids, -1, "remove"), ids);
	assert.deepEqual(ids, ["a", "b"]);
});
test("removing empty editor slots preserves held words and sentence metadata", () => {
	const held = { surface: "Piita", heldLabel: "heldOpaqueName" };
	const plan = [{ source: "source", assembly: "assembly", words: [{ canvasIds: [] }, held, { canvasIds: ["a"] }] }, { words: [{ canvasIds: [] }] }];
	assert.deepEqual(normalizeEditablePlan(plan), [{ source: "source", assembly: "assembly", words: [held, { canvasIds: ["a"] }] }]);
	assert.equal(plan[0].words.length, 3);
});
test("normalizing edits preserves a pre-existing empty sentence container", () => {
	assert.deepEqual(normalizeEditablePlan([{ source: "empty sentence", words: [] }]), [{ source: "empty sentence", words: [] }]);
});
test("editing one word invalidates only its sentence assembly and preserves neighbors", () => {
	const held = { surface: "Piita", heldLabel: "heldName" };
	const plan = [{ source: "source", assembly: "old assembly", words: [{ canvasIds: ["a", "b"] }, held, { canvasIds: ["c"] }] }, { assembly: "other assembly", words: [{ canvasIds: ["d"] }] }];
	const next = editPlanChain(plan, 0, 0, 1, "remove");
	assert.equal(next[0].assembly, undefined);
	assert.equal(next[0].source, "source");
	assert.deepEqual(next[0].words, [{ canvasIds: ["a"] }, held, { canvasIds: ["c"] }]);
	assert.equal(next[1], plan[1]);
	assert.equal(plan[0].assembly, "old assembly");
	assert.deepEqual(plan[0].words[0].canvasIds, ["a", "b"]);
});
test("no-op edits and held words retain their assembly evidence", () => {
	const plan = [{ assembly: "evidence", words: [{ canvasIds: ["a"] }, { heldLabel: "heldName", surface: "Piita" }] }];
	assert.deepEqual(editPlanChain(plan, 0, 0, 0, "left"), plan);
	assert.deepEqual(editPlanChain(plan, 0, 1, 0, "insert", "a"), plan);
});
