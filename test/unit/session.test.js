import { test } from "node:test";
import assert from "node:assert/strict";
import {
	createSession,
	clearAnalysisCaches,
	cancelDeconstruct,
	seqForChain,
	planMatchesCanvas,
	normalizeDeconstructIds,
	deconstructIdsMatchSentences,
	computeBuild,
	formatStatus,
} from "../../docs/session.js";

function preset(id, text = id) {
	return { id, seq: [{ id, text }] };
}

function fakeBuildWord(seq) {
	if (!seq.length) return { ok: false, reason: "empty", errorAt: -1 };
	if (seq.some((item) => item.id === "BAD")) {
		return { ok: false, reason: "bad join", errorAt: seq.findIndex((item) => item.id === "BAD") };
	}
	const word = seq.map((item) => item.text || item.id).join("");
	return { ok: true, word, closed: true, approximate: false };
}

test("createSession holds analysis caches off the module scope", () => {
	const session = createSession();
	assert.equal(session.mode, "build");
	assert.equal(session.lastDeconstructWord, "");
	assert.equal(session.lastSentencePlan, null);
	assert.ok(session.presetsById instanceof Map);
	session.lastDeconstructWord = "nerivoq";
	session.lastSentencePlan = { sentences: [] };
	clearAnalysisCaches(session);
	assert.equal(session.lastDeconstructWord, "");
	assert.equal(session.lastSentencePlan, null);
});

test("cancelDeconstruct aborts the controller and invalidates the run id", () => {
	const session = createSession();
	const controller = new AbortController();
	session.deconstructAbort = controller;
	session.deconstructRun = 2;
	cancelDeconstruct(session);
	assert.equal(controller.signal.aborted, true);
	assert.equal(session.deconstructAbort, null);
	assert.equal(session.deconstructRun, 3);
	cancelDeconstruct(session);
	assert.equal(session.deconstructRun, 4);
});

test("seqForChain resolves fixture presets without a live catalog", () => {
	const presetsById = new Map([
		["neri", preset("neri")],
		["V_IND_INTR_3SG", preset("V_IND_INTR_3SG", "voq")],
	]);
	assert.deepEqual(
		seqForChain(presetsById, ["neri", "V_IND_INTR_3SG"]).map((item) => item.id),
		["neri", "V_IND_INTR_3SG"],
	);
	assert.equal(seqForChain(presetsById, ["neri", "missing"]), null);
});

test("computeBuild: empty canvas with matching plan stays deconstruct", () => {
	const plan = { sentences: [{ words: [{ canvasIds: [] }] }] };
	const result = computeBuild({
		sentences: [],
		presetsById: new Map(),
		buildWord: fakeBuildWord,
		lastSentencePlan: plan,
		planMatches: true,
	});
	assert.equal(result.empty, true);
	assert.equal(result.usePlan, true);
	assert.equal(result.share.mode, "deconstruct");
	assert.equal(result.reading, "plan");
});

test("computeBuild: fixture chains return surfaces without Blockly or network", () => {
	const presetsById = new Map([
		["neri", preset("neri")],
		["V_IND_INTR_1PL", preset("V_IND_INTR_1PL", "vugut")],
	]);
	const result = computeBuild({
		sentences: [[["neri", "V_IND_INTR_1PL"]]],
		presetsById,
		buildWord: fakeBuildWord,
	});
	assert.equal(result.empty, false);
	assert.equal(result.error, null);
	assert.deepEqual(result.surfaces, ["nerivugut"]);
	assert.equal(result.kind, "ok");
	assert.equal(result.meta, "complete word");
	assert.equal(result.reading, "seqs");
	assert.equal(result.share.mode, "build");
	assert.equal(result.share.clearDeconstruct, true);
});

test("computeBuild: unknown id and join failure return error results", () => {
	const presetsById = new Map([["neri", preset("neri")], ["BAD", preset("BAD")]]);
	const missing = computeBuild({
		sentences: [[["neri", "nope"]]],
		presetsById,
		buildWord: fakeBuildWord,
	});
	assert.equal(missing.error.message, "Unknown morpheme in stack.");
	assert.equal(missing.kind, "error");

	const bad = computeBuild({
		sentences: [[["neri", "BAD"]]],
		presetsById,
		buildWord: fakeBuildWord,
	});
	assert.match(bad.error.message, /bad join/);
	assert.match(bad.error.meta, /position 2/);
});

test("computeBuild: three-word stack reports every outcome when the middle id is unknown", () => {
	const presetsById = new Map([
		["a", preset("a")],
		["c", preset("c")],
	]);
	const result = computeBuild({
		sentences: [[["a"], ["missing"], ["c"]]],
		presetsById,
		buildWord: fakeBuildWord,
	});
	assert.equal(result.wordOutcomes.length, 3);
	assert.equal(result.wordOutcomes[0].ok, true);
	assert.equal(result.wordOutcomes[1].ok, false);
	assert.equal(result.wordOutcomes[1].kind, "unknown");
	assert.equal(result.wordOutcomes[2].ok, true);
	assert.equal(result.kind, "error");
	assert.deepEqual(result.surfaces, ["a", "?", "c"]);
});

test("formatStatus: partial build outcomes become one assertive status line", () => {
	const result = computeBuild({
		sentences: [[["a"], ["nope"], ["c"]]],
		presetsById: new Map([["a", preset("a")], ["c", preset("c")]]),
		buildWord: fakeBuildWord,
	});
	const status = formatStatus(result);
	assert.equal(status.kind, "error");
	assert.equal(status.assertive, true);
	assert.match(status.detail, /Unknown morpheme/);
	assert.match(status.detail, /a/);
	assert.match(status.detail, /c/);
});

test("computeBuild: matching sentence plan keeps deconstruct share", () => {
	const presetsById = new Map([
		["illu", preset("illu")],
		["N_ABS_SG", preset("N_ABS_SG", "")],
	]);
	const plan = {
		sentences: [{ words: [{ canvasIds: ["illu", "N_ABS_SG"] }] }],
	};
	const sentences = [[["illu", "N_ABS_SG"]]];
	assert.equal(planMatchesCanvas(sentences, plan), true);
	const result = computeBuild({
		sentences,
		presetsById,
		buildWord: fakeBuildWord,
		lastSentencePlan: plan,
		planMatches: true,
	});
	assert.equal(result.usePlan, true);
	assert.equal(result.share.mode, "deconstruct");
	assert.equal(result.share.clearDeconstruct, false);
	assert.equal(result.reading, "plan");
});


test("normalizeDeconstructIds / deconstructIdsMatchSentences: single word and multi-word shapes", () => {
	assert.deepEqual(normalizeDeconstructIds(["qimmeq", "N_qaq_Vb"]), [[["qimmeq", "N_qaq_Vb"]]]);
	assert.deepEqual(
		normalizeDeconstructIds([["qimmeq"], ["neri", "V_IND_INTR_3SG"]]),
		[[["qimmeq"], ["neri", "V_IND_INTR_3SG"]]],
	);
	assert.equal(
		deconstructIdsMatchSentences([[["qimmeq", "N_qaq_Vb"]]], ["qimmeq", "N_qaq_Vb"]),
		true,
	);
	assert.equal(
		deconstructIdsMatchSentences([[["qimmeq", "N_qaq_Vb", "extra"]]], ["qimmeq", "N_qaq_Vb"]),
		false,
	);
	assert.equal(deconstructIdsMatchSentences([], ["qimmeq"]), false);
});

test("deconstructIdsMatchSentences: a two-sentence store matches, a flattened one does not", () => {
	const twoSentences = [
		[["illu", "N_ABS_SG"]],
		[["neri", "V_IND_INTR_3SG"]],
	];
	assert.deepEqual(normalizeDeconstructIds(twoSentences), twoSentences);
	assert.equal(deconstructIdsMatchSentences(twoSentences, twoSentences), true);
	assert.equal(deconstructIdsMatchSentences(twoSentences, twoSentences.flat()), false);
	const oneSentence = [["qimmeq", "N_qaq_Vb"], ["neri", "V_IND_INTR_3SG"]];
	assert.equal(deconstructIdsMatchSentences([oneSentence], oneSentence), true);
});

test("computeBuild has no history or timer side effects", () => {

	const result = computeBuild({
		sentences: [],
		presetsById: new Map(),
		buildWord: fakeBuildWord,
	});
	assert.equal(result.share.mode, null);
	assert.ok(!("timeout" in result));
	assert.ok(!("history" in result));
});
