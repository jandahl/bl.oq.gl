import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolbox, chainFromTopBlock, wordsFromBlock, topLevelSentences, presetMatchesQuery, structuralCategoryConnections, canvasTree, renderSentencePlan, restoreNounPickerFields, labelFor, labelContainers, UNRESOLVED_MORPHEME_ID } from "../../docs/blocks.js";
import { canvasIdTree, sameIdTree } from "../../docs/id-tree.js";

// buildToolbox / the canvas walkers don't touch the Blockly global. renderSentencePlan
// is exercised here with a fake workspace that only implements the connection
// surface the walker reads back — defineMorphemeBlocks still needs real Blockly.
// structuralCategoryConnections() covers stem/particle/enclitic shapes without
// the live catalog or Blockly.

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

function fakeNounPicker(candidateIds) {
	const fields = { CASE: null, POSSESSOR: null, NUMBER: null, VARIANT: "NONE" };
	const variant = {
		options: [["—", "NONE"]],
		getOptions(useCache) {
			if (useCache === false) this.options = candidateIds.map((id) => [id, id]);
			return this.options;
		},
	};
	const block = {
		data: null,
		nounEndingPickerState: {
			resolve() {
				const current = fields.VARIANT;
				block.data = candidateIds.includes(current) ? current : (candidateIds[0] ?? null);
			},
		},
		getField(name) {
			return name === "VARIANT" ? variant : null;
		},
		setFieldValue(value, name) {
			// Stale VARIANT menus reject an id they have not generated yet.
			if (name === "VARIANT" && !variant.options.some((opt) => opt[1] === value)) return;
			// Blockly runs the validator before storing the value. That
			// resolve still sees the previous VARIANT, so it must not be
			// the last write to block.data.
			if (name === "VARIANT") block.nounEndingPickerState.resolve();
			fields[name] = value;
		},
	};
	return { block, fields };
}

test("restoreNounPickerFields selects the non-first candidate of a coordinate", () => {
	const { block, fields } = fakeNounPicker(["N_ABS_POSS1SG_PL", "N_ABS_POSS1SG_PL_ARCHAIC"]);
	restoreNounPickerFields(block, {
		id: "N_ABS_POSS1SG_PL_ARCHAIC",
		lexical_facts: { morpheme_type: "inflectional_ending", case: "absolutive" },
	});
	assert.equal(fields.CASE, "absolutive");
	assert.equal(fields.POSSESSOR, "1SG");
	assert.equal(fields.NUMBER, "PL");
	assert.equal(block.data, "N_ABS_POSS1SG_PL_ARCHAIC");
});

test("restoreNounPickerFields reads case from the id when lexical_facts.case is absent", () => {
	const { block, fields } = fakeNounPicker(["N_ERG_SG"]);
	restoreNounPickerFields(block, { id: "N_ERG_SG", morpheme_type: "inflectional_ending" });
	assert.equal(fields.CASE, "ergative");
	assert.equal(block.data, "N_ERG_SG");
});

test("labelFor uses a context-map gloss default and does not throw in gloss-only mode", () => {
	const item = preset({
		id: "V_ssaar_Vb",
		expected: "-ssaar",
		morpheme_type: "derivational_affix",
		word_class: "",
		plainGloss: {
			en_short: { default: "shall eventually ___", third_singular: "shall eventually he/she ___" },
		},
		glossShort: undefined,
		gloss: undefined,
	});
	const label = labelFor(item, { showIds: false });
	assert.equal(typeof label, "string");
	assert.match(label, /shall eventually ___/);
	assert.equal(label.includes("[object Object]"), false);
	assert.equal(label.includes("he/she"), false);
	const glossOnly = labelFor(item, { spellingMode: "gloss-only" });
	assert.equal(typeof glossOnly, "string");
	assert.match(glossOnly, /^shall eventually ___/);
});

test("labelFor falls back to the first context-map value when default is absent", () => {
	const item = preset({
		id: "V_ssaar_Vb",
		expected: "-ssaar",
		plainGloss: {
			en_short: { third_singular: "shall eventually he/she ___", gerund: "eventually ___ing" },
		},
		glossShort: undefined,
		gloss: undefined,
	});
	const label = labelFor(item, { spellingMode: "gloss-only" });
	assert.equal(typeof label, "string");
	assert.match(label, /shall eventually he\/she ___/);
	assert.equal(label.includes("[object Object]"), false);
});

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

test("buildToolbox: a stem whose word class is neither N nor V goes to Stems — other", () => {
	const presets = [
		preset({ id: "qimmeq", morpheme_type: "stem", word_class: "N" }),
		preset({ id: "aamma", morpheme_type: "stem", word_class: "P" }),
	];
	const toolbox = buildToolbox(presets, { showIds: false });
	const nouns = toolbox.contents.find((c) => c.name.startsWith("Stems — nouns"));
	const other = toolbox.contents.find((c) => c.name.startsWith("Stems — other"));
	assert.deepEqual(nouns.contents.map((block) => block.data), ["qimmeq"]);
	assert.deepEqual(other.contents.map((block) => block.data), ["aamma"]);
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
	// The verb picker stays first. The object block is next to it so a Build
	// can select a transitive ending; it is not a flat ending entry.
	assert.equal(category.contents.length, 2);
	assert.equal(category.contents[0].type, "morpheme_block__verb_ending_picker");
	assert.equal(category.contents[1].type, "morpheme_block__verb_object");
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
	assert.equal(category.contents.length, 3);
	assert.equal(category.contents[0].type, "morpheme_block__verb_ending_picker");
	assert.equal(category.contents[1].type, "morpheme_block__noun_ending_picker");
	assert.equal(category.contents[2].type, "morpheme_block__verb_object");
	assert.ok(!category.contents.some((b) => b.data === "N_ABS_SG"));
	assert.match(category.name, /^Inflectional endings \(1 entries · 3 blocks\)$/);
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
	assert.equal(category.contents.length, 2);
	assert.equal(category.contents[0].type, "morpheme_block__verb_ending_picker");
	assert.equal(category.contents[1].type, "morpheme_block__verb_object");
});

function chainConnection(owner, role) {
	return {
		owner,
		role,
		target: null,
		connect(other) {
			this.target = other.owner;
			other.target = this.owner;
			if (other.role === "previous") other.owner._ws.untop(other.owner);
		},
		targetBlock() {
			return this.target;
		},
	};
}

function chainBlock(type, ws) {
	const fields = {};
	const inputs = {};
	const block = {
		type,
		data: null,
		_ws: ws,
		initSvg() {},
		render() {},
		moveBy() {},
		dispose() { ws.untop(block); },
		getFieldValue(name) { return fields[name] ?? null; },
		setFieldValue(value, name) { fields[name] = value; },
		getInput(name) { return inputs[name] ?? null; },
		getInputTargetBlock(name) { return inputs[name]?.connection.targetBlock() ?? null; },
		getNextBlock() { return block.nextConnection.targetBlock(); },
	};
	block.previousConnection = chainConnection(block, "previous");
	block.nextConnection = chainConnection(block, "next");
	if (type === "morpheme_block__word_container") {
		inputs.MORPHEMES = { connection: chainConnection(block, "input") };
	}
	if (type === "morpheme_block__sentence_container") {
		inputs.WORDS = { connection: chainConnection(block, "input") };
	}
	return block;
}

function chainWorkspace() {
	const tops = [];
	return {
		untop(block) {
			const index = tops.indexOf(block);
			if (index >= 0) tops.splice(index, 1);
		},
		getTopBlocks() { return tops.slice(); },
		newBlock(type) {
			const block = chainBlock(type, this);
			tops.push(block);
			return block;
		},
	};
}

test("renderSentencePlan: a chain keeps a zero-realization ending id", () => {
	const stem = preset({ id: "qimmeq", morpheme_type: "stem", word_class: "N", expected: "qimmeq" });
	const zero = preset({
		id: "N_ABS_SG",
		expected: "Ø",
		glossShort: "absolutive singular",
		morpheme_type: "inflectional_ending",
		lexical_facts: { morpheme_type: "inflectional_ending", case: "absolutive" },
		seq: [{ text: "", type: "INFLECTION" }],
	});
	const workspace = chainWorkspace();
	renderSentencePlan(workspace, [{ words: [{ canvasIds: ["qimmeq", "N_ABS_SG"] }] }], new Map([
		["qimmeq", stem],
		["N_ABS_SG", zero],
	]), { showIds: false });
	const word = canvasTree(workspace).sentences[0].words[0].block;
	const ending = word.getInputTargetBlock("MORPHEMES").getNextBlock();
	assert.equal(ending.type, "morpheme_block__inflection");
	assert.equal(ending.data, "N_ABS_SG");
	assert.match(ending.getFieldValue("LABEL"), /^Ø/);
	assert.deepEqual(chainFromTopBlock(word), ["qimmeq", "N_ABS_SG"]);
	assert.deepEqual(topLevelSentences(workspace), [[["qimmeq", "N_ABS_SG"]]]);
});

test("labelContainers: a null built slot does not take the next word's surface", () => {
	const workspace = chainWorkspace();
	const sentence = workspace.newBlock("morpheme_block__sentence_container");
	const words = ["a", "missing", "c"].map((id) => {
		const word = workspace.newBlock("morpheme_block__word_container");
		const stem = workspace.newBlock("morpheme_block__stem_n");
		stem.data = id;
		word.getInput("MORPHEMES").connection.connect(stem.previousConnection);
		return word;
	});
	sentence.getInput("WORDS").connection.connect(words[0].previousConnection);
	words[0].nextConnection.connect(words[1].previousConnection);
	words[1].nextConnection.connect(words[2].previousConnection);
	labelContainers(workspace, [{ word: "a" }, null, { word: "c" }], ["alpha", "", "gamma"]);
	assert.equal(words[0].getFieldValue("TITLE"), "A");
	assert.equal(words[1].getFieldValue("TITLE"), "Word");
	assert.equal(words[2].getFieldValue("TITLE"), "c");
	assert.equal(words[0].getFieldValue("TRANSLATION"), "alpha");
	assert.equal(words[1].getFieldValue("TRANSLATION"), "");
	assert.equal(words[2].getFieldValue("TRANSLATION"), "gamma");
	assert.equal(sentence.getFieldValue("TITLE"), "A c");
	assert.equal(sentence.getFieldValue("TRANSLATION"), "alpha gamma");
});

test("buildToolbox: hiding the pickers puts matching verb and noun endings back as blocks", () => {
	const verb = preset({
		id: "V_IND_INTR_1SG",
		expected: "-vunga",
		morpheme_type: "inflectional_ending",
		word_class: "",
		seq: [{ inflection: { mood: "indicative", transitivity: "intransitive", subject: { person: 1, number: "sg" } } }],
	});
	const noun = preset({
		id: "N_ABS_SG",
		expected: "-q",
		morpheme_type: "inflectional_ending",
		lexical_facts: { morpheme_type: "inflectional_ending", case: "absolutive" },
	});
	const filtered = buildToolbox([verb, noun], { showIds: false }, { includeVerbPicker: false });
	const hiddenPickers = filtered.contents.find((c) => c.name.startsWith("Inflectional endings"));
	assert.deepEqual(hiddenPickers.contents.map((block) => block.data).sort(), ["N_ABS_SG", "V_IND_INTR_1SG"]);
	assert.ok(!hiddenPickers.contents.some((block) => String(block.type).includes("picker")));
	assert.ok(!hiddenPickers.contents.some((block) => block.type === "morpheme_block__verb_object"));

	const open = buildToolbox([verb, noun], { showIds: false }).contents.find((c) => c.name.startsWith("Inflectional endings"));
	assert.ok(open.contents.some((block) => block.type === "morpheme_block__verb_ending_picker"));
	assert.ok(open.contents.some((block) => block.type === "morpheme_block__noun_ending_picker"));
	assert.ok(!open.contents.some((block) => block.data === "V_IND_INTR_1SG" || block.data === "N_ABS_SG"));
});

test("chainFromTopBlock: walks a fake block stack via getNextBlock(), collecting each block's .data", () => {
	const third = { type: "morpheme_block__inflection", data: "V_IND_INTR_1SG", getNextBlock: () => null };
	const second = { type: "morpheme_block__deriv_affix", data: "N_qaq_Vb", getNextBlock: () => third };
	const first = { type: "morpheme_block__stem_n", data: "qimmeq", getNextBlock: () => second };
	assert.deepEqual(chainFromTopBlock(first), ["qimmeq", "N_qaq_Vb", "V_IND_INTR_1SG"]);
});

test("chainFromTopBlock: a picker with no block.data stays in the chain", () => {
	const picker = { type: "morpheme_block__verb_ending_picker", data: null, getNextBlock: () => null };
	const stem = { type: "morpheme_block__stem_n", data: "qimmeq", getNextBlock: () => picker };
	assert.deepEqual(chainFromTopBlock(stem), ["qimmeq", UNRESOLVED_MORPHEME_ID]);
});

test("chainFromTopBlock: a null/undefined chain link stops the walk cleanly", () => {
	const only = { type: "morpheme_block__stem_n", data: "qimmeq", getNextBlock: () => null };
	assert.deepEqual(chainFromTopBlock(only), ["qimmeq"]);
});

test("chainFromTopBlock: ignores a non-morpheme block type (defensive; shouldn't occur in practice since only morpheme blocks connect)", () => {
	const stray = { type: "some_other_block", data: "x", getNextBlock: () => null };
	assert.deepEqual(chainFromTopBlock(stray), []);
});

test("buildToolbox: always includes Word and Sentence container categories only", () => {
	const toolbox = buildToolbox([], { showIds: false });
	const names = toolbox.contents.map((c) => c.name);
	assert.ok(names.includes("Words (1)"));
	assert.ok(names.includes("Sentences (1)"));
	assert.ok(!names.some((n) => n.startsWith("Input boundaries")));
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

test("topLevelSentences: Word and Sentence roots are collected", () => {
	const stem = { type: "morpheme_block__stem_n", data: "qimmeq", getNextBlock: () => null };
	const word = {
		type: "morpheme_block__word_container",
		getInputTargetBlock: (name) => name === "MORPHEMES" ? stem : null,
		getNextBlock: () => null,
	};
	const sentence = {
		type: "morpheme_block__sentence_container",
		getInputTargetBlock: (name) => name === "WORDS" ? word : null,
	};
	const looseStem = { type: "morpheme_block__stem_v", data: "aallarpoq", getNextBlock: () => null };
	assert.deepEqual(
		topLevelSentences({ getTopBlocks: () => [sentence, looseStem] }),
		[[["qimmeq"]], [["aallarpoq"]]],
	);
});

test("structuralCategoryConnections: stem cannot follow, particle is alone, enclitic seals", () => {
	const rules = structuralCategoryConnections();
	const byId = Object.fromEntries(rules.map((rule) => [rule.id, rule]));
	assert.equal(byId.stem_n.hasPrevious, false);
	assert.equal(byId.stem_n.previousCheck, "WORD_START");
	assert.equal(byId.stem_v.hasPrevious, false);
	assert.equal(byId.particle.hasPrevious, false);
	assert.equal(byId.particle.hasNext, false);
	assert.equal(byId.particle.nextCheck, null);
	assert.equal(byId.enclitic.hasNext, false);
	assert.equal(byId.enclitic.nextCheck, null);
	assert.equal(byId.enclitic.hasPrevious, true);
	assert.equal(byId.enclitic.previousCheck, "MORPHEME_CHAIN");
	assert.equal(byId.deriv_affix.hasPrevious, true);
	assert.equal(byId.deriv_affix.hasNext, true);
});

test("canvasTree: two sentences, a held word, and a loose chain round-trip to the same id tree", () => {
	const stemA = { type: "morpheme_block__stem_n", data: "qimmeq", getNextBlock: () => null };
	const stemB = { type: "morpheme_block__stem_v", data: "neri", getNextBlock: () => null };
	const drawable = {
		type: "morpheme_block__word_container",
		bloqHeld: null,
		getInputTargetBlock: (name) => name === "MORPHEMES" ? stemA : null,
		getNextBlock: () => held,
	};
	const held = {
		type: "morpheme_block__word_container",
		bloqHeld: "not drawn",
		getInputTargetBlock: () => null,
		getNextBlock: () => null,
	};
	const sentence = {
		type: "morpheme_block__sentence_container",
		getInputTargetBlock: (name) => name === "WORDS" ? drawable : null,
	};
	const loose = { type: "morpheme_block__stem_v", data: "aallarpoq", getNextBlock: () => null };
	const tree = canvasTree({ getTopBlocks: () => [sentence, loose] });
	assert.equal(tree.sentences.length, 2);
	assert.equal(tree.sentences[0].words.length, 2);
	assert.deepEqual(tree.sentences[0].words[0].ids, ["qimmeq"]);
	assert.equal(tree.sentences[0].words[1].held, "not drawn");
	assert.deepEqual(tree.sentences[1].words[0].ids, ["aallarpoq"]);
	const ids = canvasIdTree(tree);
	assert.deepEqual(ids, [[["qimmeq"]], [["aallarpoq"]]]);
	assert.equal(sameIdTree(ids, topLevelSentences({ getTopBlocks: () => [sentence, loose] })), true);
	assert.equal(sameIdTree(ids, [[["qimmeq", "extra"]], [["aallarpoq"]]]), false);
	void stemB;
});

test("chainFromTopBlock: a horizontal word follows NEXT plugs, not a vertical stack", () => {
	const ending = { type: "morpheme_block__inflection", data: "V_IND", getInputTargetBlock: () => null, getNextBlock: () => null };
	const stem = {
		type: "morpheme_block__stem_v",
		data: "neri",
		getInputTargetBlock: (name) => name === "NEXT" ? ending : null,
		getNextBlock: () => null,
	};
	const word = {
		type: "morpheme_block__word_container",
		getInput: (name) => name === "MORPHEMES" ? {} : null,
		getInputTargetBlock: (name) => name === "MORPHEMES" ? stem : null,
	};
	assert.deepEqual(chainFromTopBlock(word), ["neri", "V_IND"]);
});

test("chainFromTopBlock: wrap rows are read left to right, then top to bottom", () => {
	const later = { type: "morpheme_block__enclitic", data: "encl", getInputTargetBlock: () => null, getNextBlock: () => null };
	const early = { type: "morpheme_block__stem_n", data: "qimmeq", getInputTargetBlock: () => null, getNextBlock: () => null };
	const row2 = {
		type: "morpheme_block__word_row",
		getInputTargetBlock: (name) => name === "CHAIN" ? later : null,
		getNextBlock: () => null,
	};
	const row1 = {
		type: "morpheme_block__word_row",
		getInputTargetBlock: (name) => name === "CHAIN" ? early : null,
		getNextBlock: () => row2,
	};
	const word = {
		type: "morpheme_block__word_container",
		getInput: (name) => name === "ROWS" ? {} : null,
		getInputTargetBlock: (name) => name === "ROWS" ? row1 : null,
	};
	assert.deepEqual(chainFromTopBlock(word), ["qimmeq", "encl"]);
});
