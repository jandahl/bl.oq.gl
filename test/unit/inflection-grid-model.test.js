import test from "node:test";
import assert from "node:assert/strict";
import { inflectionGridGroups } from "../../docs/inflection-grid-model.js";

const ending = (id, inflection) => ({ id, morpheme_type: "inflectional_ending", seq: [{ inflection }] });

test("verb grid groups structured endings by transitivity/polarity with mood columns", () => {
	const presets = [
		ending("one", { mood: "indicative", transitivity: "intransitive", subject: { person: 1, number: "sg" } }),
		ending("two", { mood: "interrogative", transitivity: "intransitive", subject: { person: 1, number: "sg" } }),
		ending("negative", { mood: "indicative", transitivity: "intransitive", subject: { person: 1, number: "sg" }, polarity: "negative" }),
		ending("incomplete", { mood: "indicative", transitivity: "intransitive" }),
		{ id: "looks-like-ending", morpheme_type: "inflectional_ending", seq: [{ text: "-x" }] },
	];
	const groups = inflectionGridGroups(presets, "V");
	assert.equal(groups.length, 2);
	assert.deepEqual(groups[0].features, ["intransitive", "positive"]);
	assert.deepEqual(JSON.parse(groups[0].rows[0]), [1, "sg", null, null]);
	assert.deepEqual(groups[0].columns, ["\"indicative\"", "\"interrogative\""]);
	assert.equal(groups[0].cells.size, 2);
});

test("noun grid requires explicit structured case, number, and possessor fields", () => {
	const presets = [
		ending("noun-abs", { case: "absolutive", number: "sg", possessor: null }),
		ending("noun-abs-poss", { case: "absolutive", number: "sg", possessor: { person: 1, number: "sg" } }),
		ending("id-only", { case: "absolutive" }),
	];
	const groups = inflectionGridGroups(presets, "N");
	assert.equal(groups.length, 1);
	assert.deepEqual(groups[0].features, ["absolutive"]);
	assert.deepEqual(groups[0].columns, ["\"sg\""]);
	assert.deepEqual(JSON.parse(groups[0].rows[0]), [null, null]);
	assert.equal(groups[0].cells.size, 2);
});

test("unknown stem classes do not inherit a guessed paradigm", () => {
	assert.deepEqual(inflectionGridGroups([ending("one", { mood: "indicative", transitivity: "intransitive", subject: { person: 1, number: "sg" } })], "other"), []);
});
