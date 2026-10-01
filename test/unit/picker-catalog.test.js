import { test } from "node:test";
import assert from "node:assert/strict";
import { buildToolbox, bindNounPickerCatalog, nounPickerCandidates } from "../../docs/blocks.js";
import { bindVerbPickerCatalog, verbPickerCandidates } from "../../docs/verb-picker.js";
import { buildVerbEndingIndex } from "../../docs/verb-endings.js";
import { buildNounEndingIndex } from "../../docs/noun-endings.js";

function verbEnding(id, person) {
	return {
		id,
		morpheme_type: "inflectional_ending",
		meaning: id,
		glossShort: id,
		seq: [{ inflection: { mood: "indicative", transitivity: "intransitive", subject: { person, number: "sg" } } }],
	};
}

function nounEnding(id) {
	return {
		id,
		morpheme_type: "inflectional_ending",
		meaning: id,
		glossShort: id,
		lexical_facts: { morpheme_type: "inflectional_ending", case: "absolutive" },
		seq: [{}],
	};
}

test("a verb ending published after the picker was defined is still a candidate", () => {
	const first = verbEnding("V_IND_INTR_1SG", 1);
	bindVerbPickerCatalog({
		verbEndingIndex: buildVerbEndingIndex([first]),
		presetsById: new Map([[first.id, first]]),
	});
	assert.deepEqual(verbPickerCandidates("indicative", "intransitive", 2, "sg").map((c) => c.id), []);

	const added = verbEnding("V_IND_INTR_2SG", 2);
	const presets = [first, added];
	bindVerbPickerCatalog({
		verbEndingIndex: buildVerbEndingIndex(presets),
		presetsById: new Map(presets.map((preset) => [preset.id, preset])),
	});
	assert.deepEqual(verbPickerCandidates("indicative", "intransitive", 2, "sg").map((c) => c.id), ["V_IND_INTR_2SG"]);

	// The toolbox still hides the flat ending behind the picker. That is only
	// safe because the picker catalog above can select the new id.
	const open = buildToolbox(presets, { showIds: false }).contents.find((c) => c.name.startsWith("Inflectional endings"));
	assert.ok(open.contents.some((block) => block.type === "morpheme_block__verb_ending_picker"));
	assert.ok(!open.contents.some((block) => block.data === "V_IND_INTR_2SG"));
});

test("a nominal ending published after the picker was defined is still a candidate", () => {
	const first = nounEnding("N_ABS_SG");
	bindNounPickerCatalog({
		nounEndingIndex: buildNounEndingIndex([first]),
		presetsById: new Map([[first.id, first]]),
	});
	assert.deepEqual(nounPickerCandidates("absolutive", "none", "PL").map((c) => c.id), []);

	const added = nounEnding("N_ABS_PL");
	const presets = [first, added];
	bindNounPickerCatalog({
		nounEndingIndex: buildNounEndingIndex(presets),
		presetsById: new Map(presets.map((preset) => [preset.id, preset])),
	});
	assert.deepEqual(nounPickerCandidates("absolutive", "none", "PL").map((c) => c.id), ["N_ABS_PL"]);

	const open = buildToolbox(presets, { showIds: false }).contents.find((c) => c.name.startsWith("Inflectional endings"));
	assert.ok(open.contents.some((block) => block.type === "morpheme_block__noun_ending_picker"));
	assert.ok(!open.contents.some((block) => block.data === "N_ABS_PL"));
});
