import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolbox, chainFromTopBlock, wordsFromBlock, presetMatchesQuery } from "../../docs/blocks.js";

// These blocks.js exports don't touch the `Blockly` global, so they're
// unit-testable directly under
// Node — everything else (defineMorphemeBlocks, renderChain, relabelBlocks,
// the actual connection-check behaviour) needs a real Blockly runtime and is
// covered by test/e2e/ instead.

function preset(overrides) {
	return {
		id: "TEST_ID",
		glossShort: "test gloss",
		gloss: "test gloss (scholarly)",
		morpheme_type: "stem",
		word_class: "N",
		seq: [{}],
		...overrides,
	};
}

test("buildToolbox: groups presets into the right category by morpheme_type + word_class", () => {
	const presets = [
		preset({ id: "qimmeq", morpheme_type: "stem", word_class: "N" }),
		preset({ id: "aagialip", morpheme_type: "stem", word_class: "V" }),
		preset({ id: "N_qaq_Vb", morpheme_type: "derivational_affix", word_class: "" }),
	];
	const toolbox = buildToolbox(presets, { showIds: false });
	const names = toolbox.contents.map((c) => c.name);
	assert.ok(names.some((n) => n.startsWith("Stems — nouns (1)")));
	assert.ok(names.some((n) => n.startsWith("Stems — verbs (1)")));
	assert.ok(names.some((n) => n.startsWith("Derivational affixes (1)")));
});

test("buildToolbox: a category with zero matching presets doesn't appear at all (regression guard for the filter box feeling 'live')", () => {
	const presets = [preset({ id: "qimmeq", morpheme_type: "stem", word_class: "N" })];
	const toolbox = buildToolbox(presets, { showIds: false });
	const names = toolbox.contents.map((c) => c.name);
	assert.ok(!names.some((n) => n.startsWith("Enclitics")));
	assert.ok(!names.some((n) => n.startsWith("Particles")));
});

test("buildToolbox: showIds=false shows only the real Kalaallisut spelling + gloss, never the internal id, for a non-stem morpheme", () => {
	const presets = [preset({
		id: "V_IND_INTR_1SG",
		expected: "-vunga",
		glossShort: "statement — I",
		morpheme_type: "inflectional_ending",
		word_class: "",
		plainGloss: { en_mood_label: "statement" },
	})];
	const toolbox = buildToolbox(presets, { showIds: false });
	// "Inflectional endings" always gets the verb ending picker block
	// unshifted at index 0 (bl-oq-ly#18) -- find this entry by its own data
	// rather than assume a position.
	const category = toolbox.contents.find((c) => c.name.startsWith("Inflectional endings"));
	const entry = category.contents.find((b) => b.data === "V_IND_INTR_1SG");
	const label = entry.fields.LABEL;
	assert.equal(label, "-vunga — I");
	assert.ok(!label.includes("V_IND_INTR_1SG"), "internal id must not leak into the label when showIds is off");
	assert.ok(!label.includes("statement"), "mood label must be dropped from the block label entirely, not just hidden");
});

test("buildToolbox: showIds=true adds the internal id after the learner-facing spelling", () => {
	const presets = [preset({
		id: "V_IND_INTR_1SG",
		expected: "-vunga",
		glossShort: "statement — I",
		morpheme_type: "inflectional_ending",
		word_class: "",
		plainGloss: { en_mood_label: "statement" },
	})];
	const toolbox = buildToolbox(presets, { showIds: true });
	const category = toolbox.contents.find((c) => c.name.startsWith("Inflectional endings"));
	const entry = category.contents.find((b) => b.data === "V_IND_INTR_1SG");
	assert.equal(entry.fields.LABEL, "-vunga — I — V_IND_INTR_1SG");
});

test("buildToolbox: a long gloss cannot truncate away either the surface form or requested API id", () => {
	const presets = [preset({ id: "V_ngngit_Vb", expected: "-nngit", glossShort: "a deliberately very long explanation of ordinary verbal negation", morpheme_type: "sentential_affix" })];
	const toolbox = buildToolbox(presets, { showIds: true });
	const category = toolbox.contents.find((candidate) => candidate.name.startsWith("Sentential affixes"));
	const label = category.contents[0].fields.LABEL;
	assert.ok(label.startsWith("-nngit"));
	assert.ok(label.endsWith("V_ngngit_Vb"));
	assert.ok(label.length <= 60);
});

test("presetMatchesQuery: finds the ordinary negator by its real -nngit form despite its V_ngngit_Vb API id", () => {
	const negator = preset({
		id: "V_ngngit_Vb",
		expected: "-nngit",
		searchForms: ["-nngilaq"],
		glossShort: "negation, ___ not",
	});
	assert.equal(presetMatchesQuery(negator, "nngit"), true);
	assert.equal(presetMatchesQuery(negator, "nngilaq"), true);
	assert.equal(presetMatchesQuery(negator, "negation"), true);
	assert.equal(presetMatchesQuery(negator, "not present"), false);
});

test("buildToolbox: a stem's label uses its own id as the spelling (regression guard: this is why hiding ids used to also hide stem spellings by accident)", () => {
	const presets = [preset({ id: "qimmeq", expected: "qimmeq", glossShort: "dog", morpheme_type: "stem", word_class: "N" })];
	const toolbox = buildToolbox(presets, { showIds: false });
	assert.equal(toolbox.contents[0].contents[0].fields.LABEL, "qimmeq — dog");
});

test("buildToolbox: a real verb-mood ending (carrying inflection.subject) is excluded from the flat list -- it's only reachable via the conjugation picker (bl-oq-ly#18)", () => {
	const presets = [preset({
		id: "V_IND_INTR_1SG",
		expected: "-vunga",
		morpheme_type: "inflectional_ending",
		word_class: "",
		seq: [{ inflection: { mood: "indicative", transitivity: "intransitive", subject: { person: 1, number: "sg" } } }],
	})];
	const toolbox = buildToolbox(presets, { showIds: false });
	const category = toolbox.contents.find((c) => c.name.startsWith("Inflectional endings"));
	assert.ok(!category.contents.some((b) => b.data === "V_IND_INTR_1SG"));
	// The category contains one coherent picker. Object remains available as a
	// separate value block because its presence changes valency.
	assert.equal(category.contents.length, 1);
	assert.equal(category.contents[0].type, "morpheme_block__verb_ending_picker");
	assert.equal(category.contents[0].inputs, undefined);
	assert.equal(category.categorystyle, "oq_inflectional_category");
});

test("buildToolbox: structured nominal endings are replaced by the nominal picker", () => {
	const presets = [preset({
		id: "N_ABS_SG",
		morpheme_type: "inflectional_ending",
		case: "absolutive",
		lexical_facts: { morpheme_type: "inflectional_ending", case: "absolutive" },
	})];
	const toolbox = buildToolbox(presets, { showIds: false });
	const category = toolbox.contents.find((c) => c.name.startsWith("Inflectional endings"));
	assert.equal(category.contents.length, 2);
	assert.equal(category.contents[0].type, "morpheme_block__verb_ending_picker");
	assert.equal(category.contents[1].type, "morpheme_block__noun_ending_picker");
	assert.ok(!category.contents.some((b) => b.data === "N_ABS_SG"));
	assert.match(category.name, /^Inflectional endings \(1 entries · 2 blocks\)$/);
});

test("buildToolbox: zero-realization endings are not exposed as blocks", () => {
	const presets = [preset({
		id: "N_ABS_SG",
		expected: "Ø",
		morpheme_type: "inflectional_ending",
		case: "absolutive",
		seq: [{ text: "", type: "INFLECTION" }],
	})];
	const toolbox = buildToolbox(presets, { showIds: false });
	const category = toolbox.contents.find((c) => c.name.startsWith("Inflectional endings"));
	assert.ok(category);
	assert.equal(category.contents.length, 1);
	assert.equal(category.contents[0].type, "morpheme_block__verb_ending_picker");
});

test("chainFromTopBlock: walks a fake block stack via getNextBlock(), collecting each block's .data", () => {
	const third = { type: "morpheme_block__inflection", data: "V_IND_INTR_1SG", getNextBlock: () => null };
	const second = { type: "morpheme_block__deriv_affix", data: "N_qaq_Vb", getNextBlock: () => third };
	const first = { type: "morpheme_block__stem_n", data: "qimmeq", getNextBlock: () => second };
	assert.deepEqual(chainFromTopBlock(first), ["qimmeq", "N_qaq_Vb", "V_IND_INTR_1SG"]);
});

test("chainFromTopBlock: a null/undefined chain link stops the walk cleanly", () => {
	const only = { type: "morpheme_block__stem_n", data: "qimmeq", getNextBlock: () => null };
	assert.deepEqual(chainFromTopBlock(only), ["qimmeq"]);
});

test("chainFromTopBlock: ignores a non-morpheme block type (defensive; shouldn't occur in practice since only morpheme blocks connect)", () => {
	const stray = { type: "some_other_block", data: "x", getNextBlock: () => null };
	assert.deepEqual(chainFromTopBlock(stray), []);
});

test("buildToolbox: always includes Word and Sentence container categories", () => {
	const toolbox = buildToolbox([], { showIds: false });
	const names = toolbox.contents.map((c) => c.name);
	assert.ok(names.includes("Words (1)"));
	assert.ok(names.includes("Sentences (1)"));
	const words = toolbox.contents.find((c) => c.name === "Words (1)");
	const sentences = toolbox.contents.find((c) => c.name === "Sentences (1)");
	assert.equal(words.contents[0].type, "morpheme_block__word_container");
	assert.equal(sentences.contents[0].type, "morpheme_block__sentence_container");
});

test("chainFromTopBlock: unwraps a word container to its morpheme stack", () => {
	const inner = { type: "morpheme_block__stem_n", data: "qimmeq", getNextBlock: () => null };
	const container = {
		type: "morpheme_block__word_container",
		getInputTargetBlock: () => inner,
	};
	assert.deepEqual(chainFromTopBlock(container), ["qimmeq"]);
});

test("wordsFromBlock: a sentence of stacked word containers yields one chain per word", () => {
	const stemA = { type: "morpheme_block__stem_n", data: "qimmeq", getNextBlock: () => null };
	const stemB = { type: "morpheme_block__stem_n", data: "nerivoq", getNextBlock: () => null };
	const wordB = {
		type: "morpheme_block__word_container",
		getInputTargetBlock: (name) => name === "MORPHEMES" ? stemB : null,
		getNextBlock: () => null,
	};
	const wordA = {
		type: "morpheme_block__word_container",
		getInputTargetBlock: (name) => name === "MORPHEMES" ? stemA : null,
		getNextBlock: () => wordB,
	};
	const sentence = {
		type: "morpheme_block__sentence_container",
		getInputTargetBlock: (name) => name === "WORDS" ? wordA : null,
	};
	assert.deepEqual(wordsFromBlock(sentence), [["qimmeq"], ["nerivoq"]]);
});
