import test from "node:test";
import assert from "node:assert/strict";
import { wordTone, WORD_TONE_COUNT } from "../../docs/breakdown.js";

test("wordTone cycles through a stable palette", () => {
	assert.equal(wordTone(0), "0");
	assert.equal(wordTone(1), "1");
	assert.equal(wordTone(WORD_TONE_COUNT), "0");
	assert.equal(wordTone(WORD_TONE_COUNT + 2), "2");
	assert.equal(wordTone(-1), String(WORD_TONE_COUNT - 1));
});
