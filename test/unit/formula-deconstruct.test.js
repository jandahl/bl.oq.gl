import test from "node:test";
import assert from "node:assert/strict";
import { UNSPACED_FORMULA_WORD_REGEX, tokenizeFormula, buildFromFormula } from "../../docs/fixtures/engine-stub.js";

test("UNSPACED_FORMULA_WORD_REGEX detects unspaced plus formulas", () => {
	assert.ok(UNSPACED_FORMULA_WORD_REGEX.test("su+SSA+Ind+1Pl"));
	assert.ok(UNSPACED_FORMULA_WORD_REGEX.test("atuar+QAT+4SgPoss+Abs+Pl"));
	assert.ok(UNSPACED_FORMULA_WORD_REGEX.test("siulleq+Aeq+Sg"));

	// Negative cases
	assert.ok(!UNSPACED_FORMULA_WORD_REGEX.test("su + SSA"));
	assert.ok(!UNSPACED_FORMULA_WORD_REGEX.test("word1 + word2"));
	assert.ok(!UNSPACED_FORMULA_WORD_REGEX.test("word+"));
	assert.ok(!UNSPACED_FORMULA_WORD_REGEX.test("+word"));
	assert.ok(!UNSPACED_FORMULA_WORD_REGEX.test("word"));
});

test("tokenizeFormula splits formula on +", () => {
	assert.deepEqual(tokenizeFormula("su+SSA+Ind+1Pl"), ["su", "SSA", "Ind", "1Pl"]);
});

test("buildFromFormula returns word and sequence", () => {
	const res = buildFromFormula("su+SSA+Ind+1Pl");
	assert.ok(res.ok);
	assert.equal(res.word, "suSSAInd1Pl");
	assert.equal(res.seq.length, 4);
});
