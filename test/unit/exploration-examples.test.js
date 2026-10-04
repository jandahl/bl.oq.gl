import test from "node:test";
import assert from "node:assert/strict";
import { contrastSuggestions, inflectionExamples } from "../../docs/exploration-examples.js";

const presets = new Map([
	["neri", { id: "neri", word_class: "V", seq: [{ text: "neri" }] }],
	...[1, 3].map((person) => {
		const id = `ending${person}`;
		return [id, { id, morpheme_type: "inflectional_ending", seq: [{ text: person === 1 ? "vunga" : "voq", inflection: { mood: "indicative", transitivity: "intransitive", subject: { person, number: "sg" } } }] }];
	}),
	["V_ngngit_Vb", { id: "V_ngngit_Vb", seq: [{ text: "nngit" }] }],
]);
const buildWord = (seq) => ({ ok: true, closed: true, approximate: false, word: seq.map((i) => i.text).join("") });

test("exploration examples keep the same stem and change one grammatical axis", () => {
	assert.deepEqual(inflectionExamples(presets, buildWord), [{ id: "neri", wordClass: "V", forms: ["nerivunga", "nerivoq"] }]);
	assert.deepEqual(contrastSuggestions(["neri", "ending1"], presets, buildWord), [
		{ ids: ["neri", "ending3"], surface: "nerivoq", reason: "contrastChangeSubject" },
		{ ids: ["neri", "V_ngngit_Vb", "ending1"], surface: "nerinngitvunga", reason: "contrastChangeNegation" },
	]);
});

test("suggestions never use approximate, open, rejected, or missing chains", () => {
	for (const result of [{ ok: false }, { ok: true, closed: false }, { ok: true, closed: true, approximate: true }]) {
		assert.deepEqual(inflectionExamples(presets, () => result), []);
		assert.deepEqual(contrastSuggestions(["neri", "ending1"], presets, () => result), []);
	}
	assert.deepEqual(contrastSuggestions(["UNKNOWN", "ending1"], presets, () => { throw new Error("should not build"); }), []);
	assert.deepEqual(inflectionExamples(presets, () => { throw new Error("engine failure"); }), []);
});

test("changing mood or object is not presented as just changing the subject", () => {
	const next = new Map(presets);
	next.set("ending3", { ...presets.get("ending3"), seq: [{ text: "bad", inflection: { mood: "imperative", transitivity: "intransitive", subject: { person: 3, number: "sg" } } }] });
	assert.equal(contrastSuggestions(["neri", "ending1"], next, buildWord).some((s) => s.reason === "contrastChangeSubject"), false);
});
