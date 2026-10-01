// Verb ending picker. Moved out of blocks.js so the conjugation block can
// change without rewriting the category connection rules. Field names,
// connection check strings, and which id resolveVerbPicker chooses are the
// same as before the move.
//
// labelFor and applyChainConnections stay in blocks.js. bindVerbPickerHost
// runs while that module evaluates, before any picker is defined.

import { candidatesFor, parsePersonNumber, personNumberLabel, moodDisplayLabel } from "./verb-endings.js";
import { t } from "./i18n.js";

const BLOCK_TYPE_PREFIX = "morpheme_block__";
export const VERB_ENDING_PICKER_TYPE = `${BLOCK_TYPE_PREFIX}verb_ending_picker`;
export const VERB_MOOD_TYPE = `${BLOCK_TYPE_PREFIX}verb_mood`;
export const VERB_SUBJECT_TYPE = `${BLOCK_TYPE_PREFIX}verb_subject`;
export const VERB_OBJECT_TYPE = `${BLOCK_TYPE_PREFIX}verb_object`;
const VERB_OBJECT_CONNECTION_TYPE = "VERB_OBJECT";
const VERB_MOOD_CONNECTION_TYPE = "VERB_MOOD";
const VERB_SUBJECT_CONNECTION_TYPE = "VERB_SUBJECT";
const INFLECTION_BLOCK_STYLE = "oq_inflectional_blocks";
const UI_INDENT = "\u00a0\u00a0\u00a0\u00a0";

let labelFor = () => "";
let applyChainConnections = () => {};

/** @param {{ labelFor: Function, applyChainConnections: Function }} host */
export function bindVerbPickerHost(host) {
	labelFor = host.labelFor;
	applyChainConnections = host.applyChainConnections;
}

// The block types are registered once. A later catalog refresh must not keep
// resolving against the index and map captured at that call: menus, __resolve,
// and variant validators read this object.
const verbCatalog = {
	index: null,
	presetsById: new Map(),
	getDisplayOptions: () => ({}),
	resolveMoodLabel: (mood) => ({ text: String(mood ?? ""), title: null }),
	resolvePersonLabel: () => "",
};
const polarityMapping = {};
const polarityFallback = [["affirmative", "positive"], ["negative", "negative"]];

function refreshPolarityMapping() {
	for (const key of Object.keys(polarityMapping)) delete polarityMapping[key];
	const index = verbCatalog.index;
	for (const mood of index?.moods ?? []) {
		polarityMapping[mood] = (index.polaritiesByMood.get(mood) ?? ["positive"]).map((polarity) => [
			polarity === "negative" ? "negative" : "affirmative", polarity,
		]);
	}
}

/**
 * Point every already-defined picker at a new catalog. Safe to call again
 * when revalidateCatalog replaces session.presets.
 * @param {{
 *   verbEndingIndex?: ReturnType<import("./verb-endings.js").buildVerbEndingIndex>,
 *   presetsById?: Map<string, any>,
 *   getDisplayOptions?: () => object,
 *   resolveMoodLabel?: (mood: string) => { text: string, title: string|null },
 *   resolvePersonLabel?: (person: number, number: string) => string,
 * }} [next]
 */
export function bindVerbPickerCatalog(next = {}) {
	if (next.verbEndingIndex) verbCatalog.index = next.verbEndingIndex;
	if (next.presetsById) verbCatalog.presetsById = next.presetsById;
	if (typeof next.getDisplayOptions === "function") verbCatalog.getDisplayOptions = next.getDisplayOptions;
	if (typeof next.resolveMoodLabel === "function") verbCatalog.resolveMoodLabel = next.resolveMoodLabel;
	if (typeof next.resolvePersonLabel === "function") verbCatalog.resolvePersonLabel = next.resolvePersonLabel;
	if (next.verbEndingIndex) refreshPolarityMapping();
}

/** Candidates for one grammatical selection against the catalog bound now. */
export function verbPickerCandidates(mood, transitivity, sPerson, sNumber, oPerson, oNumber, polarity = "positive") {
	if (!verbCatalog.index) return [];
	return candidatesFor(verbCatalog.index, mood, transitivity, sPerson, sNumber, oPerson, oNumber, polarity);
}

function liveMoodOptions() {
	const index = verbCatalog.index;
	if (!index?.moods?.length) return [["—", "NONE"]];
	return index.moods.map((mood) => [moodDisplayLabel(mood, verbCatalog.resolveMoodLabel), mood]);
}

function liveSubjectOptions(combos = verbCatalog.index?.subjectCombos) {
	if (!combos?.length) return [["—", "NONE"]];
	return combos.map((combo) => [personNumberLabel(combo, verbCatalog.resolvePersonLabel), combo]);
}

function liveObjectOptions() {
	return liveSubjectOptions(verbCatalog.index?.objectCombos);
}

// ---------------------------------------------------------------------------
// Verb ending picker (bl-oq-ly#18, object-as-plug-in bl-oq-ly#20 follow-up)
// — a conjugation-style block, the same paradigm shape as oq's own
// conjugation modal, replacing a flat scroll through ~278 individual
// mood-ending entries. Mood, polarity, and subject are explicit fields on
// the ending itself; object remains an optional typed value socket because
// it changes valency and has its own meaningful block structure.
//
// Transitivity is no longer its own dropdown: it's DERIVED from whether a
// VERB_OBJECT_TYPE block is plugged into the picker's OBJECT_SLOT value
// input -- a real, typed (VERB_OBJECT_CONNECTION_TYPE) puzzle-piece
// connection, dangling/optional the same way a math block's operand socket
// can sit empty. This is the idiomatic Blockly mechanism for "an optional
// value that also carries its own choice" (here: which object), rather than
// a yes/no dropdown plus a second, conditionally-visible dropdown -- a real
// user drag-connecting/disconnecting the object block IS the "with/without
// an object" choice. registerVerbPickerReactivity() (below) is what makes
// the picker re-resolve when that connection (or the connected object
// block's own dropdown) changes, since a field validator can only observe
// changes to the picker's OWN fields, not a plugged-in block's.
//
// 23 of those 278 endings collide on identical paradigm coordinates (e.g.
// plain vs. negative contemporative) -- ./verb-endings.js's candidatesFor()
// surfaces every match for a given combination; when there's more than one,
// a "variant" dropdown appears, built fresh from that combination's real
// candidates via a per-instance FieldDropdown menu generator (never a
// module-level shared list -- multiple picker blocks can be on the canvas
// at once with different combinations selected).
//
// Subject and object are each a single combined choice ("I" / "you" /
// "he, she, it" / ...), the same "Subject"/"Object" pattern oq's own
// conjugation modal uses instead of separate person and number pickers.
// Mood/person labels come from oq's own resolveMoodLabel()/
// resolvePersonLabel() (oq#881) -- plain-language by default, e.g.
// "statement" rather than "indicative" -- not a bespoke grammar-terms
// vocabulary a non-linguist learner wouldn't know.

function subjectCombosFor(block) {
	const index = verbCatalog.index;
	if (!index) return [];
	const mood = block?.getFieldValue("MOOD");
	const transitivity = block?.getInputTargetBlock("OBJECT_SLOT") ? "transitive" : "intransitive";
	return index.subjectCombosByMoodTransitivity.get(`${mood}|${transitivity}`)
		?? index.subjectCombos;
}

/**
 * Recomputes which real morpheme id the picker's grammatical controls
 * resolve to, and updates the
 * block's visible state (variant dropdown shown only when the combination is
 * ambiguous, RESOLVED label showing the real Kalaallisut spelling+gloss).
 *
 * `variantOverride` carries the parent block's one remaining field while it
 * is in the middle of changing. Mood, polarity, and subject are fields on
 * the parent; object is a typed value block observed by the workspace
 * listener after its changes commit.
 */
function resolveVerbPicker(block, variantOverride) {
	const index = verbCatalog.index;
	const presetsById = verbCatalog.presetsById;
	const getDisplayOptions = verbCatalog.getDisplayOptions;
	const moodBlock = block.getInputTargetBlock("MOOD_SLOT");
	const subjectBlock = block.getInputTargetBlock("SUBJECT_SLOT");
	const mood = block.getFieldValue("MOOD") ?? moodBlock?.getFieldValue("MOOD");
	let subjectValue = block.getFieldValue("SUBJECT") ?? subjectBlock?.getFieldValue("COMBO");
	const subjectField = block.getField("SUBJECT");
	const validSubjects = subjectCombosFor(block);
	if (subjectField && validSubjects.length && !validSubjects.includes(subjectValue)) {
		// setValue checks the cached menu. Regenerate it for this mood and
		// transitivity or the correction no-ops and the old person sticks.
		subjectField.getOptions(false);
		subjectField.setValue(validSubjects[0]);
		subjectValue = subjectField.getValue();
	}
	const { person: sPerson, number: sNumber } = subjectValue
		? parsePersonNumber(subjectValue)
		: { person: undefined, number: undefined };
	const polarity = block.getFieldValue("POLARITY") ?? "positive";

	const objectBlock = block.getInputTargetBlock("OBJECT_SLOT");
	const isTransitive = objectBlock != null;
	const transitivity = isTransitive ? "transitive" : "intransitive";
	const { person: oPerson, number: oNumber } = isTransitive
		? parsePersonNumber(objectBlock.getFieldValue("COMBO"))
		: { person: undefined, number: undefined };

	const candidates = index && mood && subjectValue
		? candidatesFor(index, mood, transitivity, sPerson, sNumber, oPerson, oNumber, polarity)
		: [];
	const variantInput = block.getInput("VARIANT_GROUP");
	const variantField = block.getField("VARIANT");

	let resolvedId = null;
	if (candidates.length === 1) {
		resolvedId = candidates[0].id;
		if (variantInput) variantInput.setVisible(false);
	} else if (candidates.length > 1) {
		block.verbPickerState = { candidateOptions: candidates.map((c) => [c.label.slice(0, 70), c.id]) };
		if (variantInput) variantInput.setVisible(true);
		const currentValue = variantOverride ?? variantField?.getValue();
		const stillValid = candidates.some((c) => c.id === currentValue);
		resolvedId = stillValid ? currentValue : candidates[0].id;
		// Only re-point the field at a new default when the *previous*
		// combination's variant no longer applies -- never overwrite a
		// value this exact call is already in the middle of committing.
		if (!stillValid && variantField && variantOverride === undefined) variantField.setValue(resolvedId);
	} else {
		if (variantInput) variantInput.setVisible(false);
	}

	block.data = resolvedId;
	const resolvedField = block.getField("RESOLVED");
	if (resolvedField) {
		const preset = resolvedId ? presetsById.get(resolvedId) : null;
		const missing = !mood && !moodBlock ? t("chooseMood") : !subjectValue ? t("chooseSubject") : t("noSuchEnding");
		resolvedField.setValue(preset ? labelFor(preset, getDisplayOptions()) : `(${missing})`);
	}
	// init()'s own initial call runs before initSvg()/render() ever have --
	// nothing to re-render yet at that point, and calling render() early
	// throws.
	if (block.rendered) block.render();
}

/**
 * Registers the verb ending picker block type. Call once, after the catalog
 * (and therefore verbEndingIndex) is available.
 * @param {ReturnType<typeof buildVerbEndingIndex>} verbEndingIndex
 * @param {Map<string, any>} presetsById
 * @param {() => object} getDisplayOptions - reads current live display
 *   options (app.js's showIds/lang/spellingMode) each time the block's
 *   resolved-spelling field needs to re-render, so it always reflects
 *   whatever the learner has currently toggled, same as relabelBlocks()
 *   does for ordinary blocks.
 * @param {(mood: string) => { text: string, title: string|null }} resolveMoodLabel
 *   oq's public-api export (oq#881) -- see verb-endings.js's header comment
 *   on why it's passed in here rather than imported directly.
 * @param {(person: number, number: string) => string} resolvePersonLabel oq's public-api export.
 */
export function defineVerbEndingPickerBlock(verbEndingIndex, presetsById, getDisplayOptions, resolveMoodLabel, resolvePersonLabel) {
	bindVerbPickerCatalog({ verbEndingIndex, presetsById, getDisplayOptions, resolveMoodLabel, resolvePersonLabel });

	function onVariantChange(newValue) {
		const block = this.getSourceBlock();
		if (block) resolveVerbPicker(block, newValue);
		return newValue;
	}

	Blockly.Blocks[VERB_MOOD_TYPE] = {
		init() {
			this.appendDummyInput()
				.appendField(new Blockly.FieldDropdown(liveMoodOptions), "MOOD");
			this.setOutput(true, VERB_MOOD_CONNECTION_TYPE);
			this.setStyle(INFLECTION_BLOCK_STYLE);
			this.setInputsInline(true);
			this.setTooltip("Verb mood");
		},
	};

	Blockly.Blocks[VERB_SUBJECT_TYPE] = {
		init() {
			this.appendDummyInput()
				.appendField(new Blockly.FieldDropdown(liveSubjectOptions), "COMBO");
			this.setOutput(true, VERB_SUBJECT_CONNECTION_TYPE);
			this.setStyle(INFLECTION_BLOCK_STYLE);
			this.setInputsInline(true);
			this.setTooltip("Verb subject");
		},
	};

	Blockly.Blocks[VERB_ENDING_PICKER_TYPE] = {
		init() {
			this.verbPickerState = { candidateOptions: [["—", "NONE"]] };

			this.appendDummyInput("RESOLVED")
				.appendField(new Blockly.FieldLabelSerializable(""), "RESOLVED");
			this.appendDummyInput("MOOD_ROW")
				.appendField(`${UI_INDENT}Mood`)
				.appendField(new Blockly.FieldDropdown(liveMoodOptions), "MOOD");
			this.appendDummyInput("POLARITY_ROW")
				.appendField(`${UI_INDENT}Polarity`)
				.appendField(new FieldDependentDropdown("MOOD", polarityMapping, polarityFallback), "POLARITY");
			this.appendDummyInput("SUBJECT_ROW")
				.appendField(`${UI_INDENT}${t("verbSubject")}`)
				.appendField(new Blockly.FieldDropdown(function () {
					const source = this.getSourceBlock();
					return liveSubjectOptions(subjectCombosFor(source));
				}), "SUBJECT");
			this.appendValueInput("OBJECT_SLOT")
				.setCheck(VERB_OBJECT_CONNECTION_TYPE)
				.appendField(`${UI_INDENT}Object (optional)`);
			this.appendDummyInput("VARIANT_GROUP")
				.appendField(`${UI_INDENT}Variant`)
				.appendField(new Blockly.FieldDropdown(function () {
					// `this` is the FieldDropdown instance here (called as
					// `this.menuGenerator_()` inside Blockly's own getOptions()),
					// NOT the block or module scope -- an arrow function here
					// would silently break this. Per-instance state lives on the
					// owning block, never a module-level shared list, since
					// multiple picker blocks can each have a different
					// combination (and so a different variant list) selected
					// at once.
					return this.getSourceBlock()?.verbPickerState?.candidateOptions ?? [["—", "NONE"]];
				}, onVariantChange), "VARIANT");
			this.setStyle(INFLECTION_BLOCK_STYLE);
			this.setInputsInline(false);
			applyChainConnections(this, { hasNext: true }, { inline: false });
			resolveVerbPicker(this);
		},
	};

	Blockly.Blocks[VERB_ENDING_PICKER_TYPE].__resolve = (block) => resolveVerbPicker(block);
}

/** Re-run __resolve on pickers already on the canvas after a catalog swap. */
export function reresolveBoundVerbPickers(workspace) {
	const resolve = Blockly.Blocks[VERB_ENDING_PICKER_TYPE]?.__resolve;
	if (!workspace || !resolve) return;
	for (const block of workspace.getAllBlocks(false)) {
		if (block.type === VERB_ENDING_PICKER_TYPE) resolve(block);
	}
}

/**
 * Registers the small object-selector block (bl-oq-ly#20 follow-up): a
 * value/output block, never part of the main stem-to-ending chain, whose
 * only purpose is plugging sideways into a verb ending picker's OBJECT_SLOT.
 * Its own COMBO dropdown is the same "I"/"you"/"he, she, it" choice the
 * subject selector uses, just for the object role.
 * @param {ReturnType<typeof buildVerbEndingIndex>} verbEndingIndex
 * @param {(person: number, number: string) => string} resolvePersonLabel oq's public-api export.
 */
export function defineVerbObjectBlock(verbEndingIndex, resolvePersonLabel) {
	bindVerbPickerCatalog({
		...(verbEndingIndex ? { verbEndingIndex } : {}),
		...(resolvePersonLabel ? { resolvePersonLabel } : {}),
	});
	Blockly.Blocks[VERB_OBJECT_TYPE] = {
		init() {
			this.appendDummyInput()
				.appendField(new Blockly.FieldDropdown(liveObjectOptions), "COMBO");
			this.setOutput(true, VERB_OBJECT_CONNECTION_TYPE);
			this.setStyle(INFLECTION_BLOCK_STYLE);
			this.setInputsInline(true);
			this.setTooltip("Verb object");
		},
	};
}

/**
 * Wires reactivity for plugging/unplugging the object block and editing its
 * dropdown. Those changes need to
 * re-resolve the OWNING picker -- not just whichever block's event actually
 * fired. VARIANT remains a field on the parent with its own validator. One workspace-
 * level listener, not one per block, since a picker block doesn't exist yet
 * (and the workspace doesn't either) at defineVerbEndingPickerBlock() time
 * -- app.js calls this once, right after Blockly.inject().
 *
 * Re-resolves every picker block on the workspace on every relevant event
 * rather than trying to trace which picker owns the block that changed --
 * workspaces here hold at most a handful of blocks, so the redundant work
 * is negligible, and it sidesteps having to walk from a moved/changed block
 * back up to whichever picker (if any) it's connected under. Self-
 * terminating: resolveVerbPicker's own field.setValue() calls only actually
 * fire a further change event when the value is genuinely different (a
 * Blockly Field's own no-op guard), so a resolve that lands on an unchanged
 * result doesn't retrigger this listener again.
 * @param {ReturnType<typeof Blockly.inject>} workspace
 */
export function registerVerbPickerReactivity(workspace) {
	const resolveAll = () => {
		for (const block of workspace.getAllBlocks(false)) {
			if (block.type === VERB_ENDING_PICKER_TYPE) Blockly.Blocks[VERB_ENDING_PICKER_TYPE].__resolve(block);
		}
	};
	workspace.addChangeListener((event) => {
		if (event.type !== Blockly.Events.BLOCK_MOVE && event.type !== Blockly.Events.BLOCK_CHANGE) return;
		resolveAll();
	});
	// Serialization loads with Blockly events suppressed. Resolve once when
	// registering so a rebuilt workspace does not retain a stale picker state.
	resolveAll();
}

/** "person|number" combo string shared by subject/object selector fields
 * (see verb-endings.js's personNumberKey/parsePersonNumber). */
function comboKey(person, number) {
	return `${person}|${number}`;
}

/**
 * Populates a freshly-created verb ending picker with matching mood, polarity,
 * and subject fields (plus an object block for a transitive ending) for a specific
 * real morpheme id -- mood, subject, polarity, object, and (when `preset.id` is one
 * of the ~23 that share paradigm coordinates with another ending) the right
 * VARIANT -- so the block stays as adjustable as if it had been dragged
 * fresh from the toolbox, rather than a frozen, non-interactive stand-in
 * for that one id. `block` must already be initSvg()'d/render()'d (each
 * setFieldValue below fires the field's own validator, which re-renders as
 * it goes -- see resolveVerbPicker's own `if (block.rendered)` guard).
 * @param {ReturnType<typeof Blockly.inject>} workspace
 */
export function restoreVerbPickerFields(workspace, block, preset) {
	const inflection = preset.seq[0].inflection;
	block.setFieldValue(inflection.mood, "MOOD");
	block.setFieldValue(inflection.polarity ?? "positive", "POLARITY");
	if (inflection.object) {
		const objectBlock = workspace.newBlock(VERB_OBJECT_TYPE);
		objectBlock.initSvg();
		objectBlock.render();
		objectBlock.setFieldValue(comboKey(inflection.object.person, inflection.object.number), "COMBO");
		block.getInput("OBJECT_SLOT").connection.connect(objectBlock.outputConnection);
	}
	// The menu generator's first run is before the field is on the block, so
	// the cache is every subject combo and a later setValue usually works.
	// Once something has realized the menu for the intransitive init mood
	// (getOptions(false): opening the dropdown, or the corrective path),
	// the cache is only that mood's subjects. Refresh after the object is
	// connected, then set the real combo, or setFieldValue no-ops.
	const subjectField = block.getField("SUBJECT");
	subjectField?.getOptions(false);
	block.setFieldValue(comboKey(inflection.subject.person, inflection.subject.number), "SUBJECT");
	// Selector connections resolve through workspace events in normal use;
	// force one synchronously while restoring so the variant check below sees
	// the final coordinate immediately.
	Blockly.Blocks[VERB_ENDING_PICKER_TYPE].__resolve(block);
	// Only the paradigm coordinates above are guaranteed to already resolve
	// to `preset.id` -- when they resolve to more than one candidate (a
	// duplicate-coordinate combination), the variant dropdown defaults to
	// its first option, which isn't necessarily the specific id being
	// restored, so pick it explicitly.
	const variantField = block.getField("VARIANT");
	if (block.data !== preset.id && block.getInput("VARIANT_GROUP")?.isVisible() && variantField) {
		// Blockly's FieldDropdown caches its (dynamic, function-generated)
		// menu and validates a setValue() call against that cache -- the
		// SUBJECT/OBJECT field-change above is what populated
		// block.verbPickerState.candidateOptions with this combination's
		// real candidates, but the VARIANT field's own cached option list
		// was last generated back when it was still just [["—","NONE"]]
		// (block creation). Without forcing a refresh here, setFieldValue()
		// below silently no-ops -- preset.id isn't among the STALE cached
		// options -- leaving the field (and block.data) on whichever
		// candidate happened to resolve first, not the one being restored.
		variantField.getOptions(false);
		block.setFieldValue(preset.id, "VARIANT");
	}
}
