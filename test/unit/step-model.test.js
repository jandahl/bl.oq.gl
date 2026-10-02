import test from "node:test";
import assert from "node:assert/strict";
import { derivationStages } from "../../docs/step-model.js";
test("stages build every prefix and preserve open/approximate/error states", () => {
	const seq = [{ id: "root" }, { id: "zero", text: "" }, { id: "bad" }];
	const calls = [];
	const stages = derivationStages(seq, (prefix) => { calls.push(prefix); return prefix.length === 3 ? { ok: false, reason: "invalid join" } : { ok: true, word: "engine output", closed: prefix.length === 1, approximate: prefix.length === 2 }; });
	assert.deepEqual(calls.map((p) => p.length), [1, 2, 3]);
	assert.equal(stages[1].item.id, "zero"); assert.equal(stages[1].built.closed, false); assert.equal(stages[1].built.approximate, true);
	assert.equal(stages[2].built.reason, "invalid join"); assert.equal(seq.length, 3);
});
test("an exception stays an explicit failed stage without losing later stages", () => {
	const stages = derivationStages([{}, {}], () => { throw new Error("missing source"); });
	assert.equal(stages.length, 2); assert.equal(stages[0].built.ok, false); assert.equal(stages[1].built.reason, "missing source");
});
