import { test } from "node:test";
import assert from "node:assert/strict";
import { readState, writeState, routeForState } from "../../docs/router.js";

test("readState: a bare/empty search string falls back to build mode, no word, no chain", () => {
	assert.deepEqual(readState(""), { mode: "build", word: "", chain: [], words: [] });
	assert.deepEqual(readState("?"), { mode: "build", word: "", chain: [], words: [] });
});

test("readState: an invalid/unrecognized mode value falls back to build rather than throwing", () => {
	assert.equal(readState("?mode=nonsense").mode, "build");
	assert.equal(readState("?mode=").mode, "build");
});

test("readState: reads the canonical single-page query string", () => {
	assert.deepEqual(readState("?w=qimmeqarpunga"), {
		mode: "deconstruct", word: "qimmeqarpunga", chain: [], words: [],
	});
	assert.deepEqual(readState("?chain=qimmeq,N_qaq_Vb,V_IND_INTR_1SG"), {
		mode: "build", word: "", chain: ["qimmeq", "N_qaq_Vb", "V_IND_INTR_1SG"],
		words: [["qimmeq", "N_qaq_Vb", "V_IND_INTR_1SG"]],
	});
});

test("readState: accepts the old mode/word link format", () => {
	assert.deepEqual(readState("?mode=deconstruct&word=qimmeqarpunga"), {
		mode: "deconstruct", word: "qimmeqarpunga", chain: [], words: [],
	});
});

test("readState: a stray/blank entry in the chain list (e.g. a trailing comma) is dropped, not kept as an empty id", () => {
	assert.deepEqual(readState("?chain=qimmeq,,N_qaq_Vb,").chain, ["qimmeq", "N_qaq_Vb"]);
});

test("writeState: entirely-default state produces an empty string, not a query string full of defaults", () => {
	assert.equal(writeState({ mode: "build", word: "", chain: [] }), "");
	assert.equal(writeState({}), "");
	assert.equal(writeState(), "");
});

test("writeState: only emits the active mode's params", () => {
	assert.equal(writeState({ mode: "deconstruct", word: "", chain: [] }), "");
	assert.equal(writeState({ mode: "deconstruct", word: "qimmeqarpunga", chain: ["stale"] }), "?w=qimmeqarpunga");
	assert.equal(writeState({ mode: "build", word: "", chain: ["qimmeq"] }), "?chain=qimmeq");
});

test("writeState: a multi-morpheme chain is comma-joined in order", () => {
	assert.equal(
		writeState({ mode: "build", chain: ["qimmeq", "N_qaq_Vb", "V_IND_INTR_1SG"] }),
		"?chain=qimmeq%2CN_qaq_Vb%2CV_IND_INTR_1SG",
	);
});

test("writeState/readState: multiple words encode as semicolon-separated chains", () => {
	const state = {
		mode: "build",
		word: "",
		chain: ["qimmeq"],
		words: [["qimmeq"], ["nerivoq"]],
	};
	assert.equal(writeState(state), "?chain=qimmeq%3Bnerivoq");
	assert.deepEqual(readState(writeState(state)), state);
});

test("writeState/readState round-trip: what writeState produces, readState reads back identically", () => {
	const states = [
		{ mode: "build", word: "", chain: [], words: [] },
		{ mode: "deconstruct", word: "qimmeqarpunga", chain: [], words: [] },
		{ mode: "build", word: "", chain: ["qimmeq", "N_qaq_Vb", "V_IND_INTR_1SG"], words: [["qimmeq", "N_qaq_Vb", "V_IND_INTR_1SG"]] },
	];
	for (const state of states) assert.deepEqual(readState(writeState(state)), state);
});

test("writeState: a word containing characters that need percent-encoding (e.g. a space) survives the round-trip", () => {
	const state = { mode: "deconstruct", word: "qimmeq arpunga", chain: [], words: [] };
	assert.deepEqual(readState(writeState(state)), state);
});

test("routeForState: always uses the single-page route and preserves the site base path", () => {
	assert.equal(routeForState("/"), "/");
	assert.equal(routeForState("/deconstruct/"), "/");
	assert.equal(routeForState("/bl-oq-ly/"), "/bl-oq-ly/");
});
