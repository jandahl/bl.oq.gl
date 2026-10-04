import test from "node:test";
import assert from "node:assert/strict";
import { surfaceRibbonSegments } from "../../docs/surface-ribbon-model.js";

const node = (start, end, surfaceText, zero_surface = false) => ({ zero_surface, surface: { surfaceStart: start, surfaceEnd: end, surfaceText } });

test("surface ribbon follows contiguous API spans and preserves zero forms", () => {
	const result = surfaceRibbonSegments("qimmeqarpunga", [node(0, 5, "qimme"), node(5, 8, "qar"), node(8, 13, "punga"), node(13, 13, "", true)]);
	assert.equal(result.aligned, true);
	assert.deepEqual(result.segments.map((segment) => [segment.kind, segment.text]), [["morpheme", "qimme"], ["morpheme", "qar"], ["morpheme", "punga"], ["morpheme", ""]]);
});

test("surface ribbon shows API word text left between morpheme spans", () => {
	const result = surfaceRibbonSegments("ab-cd", [node(0, 2, "ab"), node(3, 5, "cd")]);
	assert.deepEqual(result.segments.map((segment) => [segment.kind, segment.text]), [["morpheme", "ab"], ["unmapped", "-"], ["morpheme", "cd"]]);
});

test("surface ribbon places an API zero-surface node at its uniquely bounded position", () => {
	const result = surfaceRibbonSegments("qimmeq", [node(0, 6, "qimmeq"), { zero_surface: true }]);
	assert.equal(result.aligned, true);
	assert.deepEqual(result.segments.map((segment) => [segment.kind, segment.text]), [["morpheme", "qimmeq"], ["morpheme", ""]]);
});

test("surface ribbon refuses to guess a zero-surface position across an unmapped gap", () => {
	const result = surfaceRibbonSegments("qimm?q", [node(0, 4, "qimm"), { zero_surface: true }, node(5, 6, "q")]);
	assert.deepEqual(result, { segments: [], aligned: false });
});

test("invalid, missing, overlapping, or mismatched engine offsets have no alignment", () => {
	for (const [surface, spans] of [
		["abc", []], ["abc", [node(0, 2, "ab"), node(1, 3, "bc")]],
		["abc", [node(0, 2, "ac")]], ["abc", [node(0, 4, "abcd")]],
		["abc", [{ surface: null }]], ["abc", [node(2, 1, "")]],
	]) assert.deepEqual(surfaceRibbonSegments(surface, spans), { segments: [], aligned: false });
});
