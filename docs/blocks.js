// Defines one Blockly block *type* per grammarian morpheme category, all
// snapping only to each other in a single top-to-bottom stack. This is
// deliberate — a Kalaallisut morpheme chain is linear and order-strict (stem
// first, WORD_FINAL-continuation closer last), not a general graph, so
// Blockly's previous/next statement connections (which only ever form a
// single chain per stack) are already the right shape without any extra
// validation code. Real legality of a given *join* (not just the stack
// shape) is still checked live by oq's buildWord(), never by Blockly.
//
// Each morpheme gets its own fixed toolbox flyout entry (id in block.data,
// label pre-set from the catalog) rather than one block type with a giant
// dropdown of every morpheme — a ~2000-option native <select> is both
// mobile-hostile (bl-oq-ly#1) and gives no visual cue about morpheme type,
// which let a non-stem read as a stem in the old single flat list
// (bl-oq-ly#1). One block type per category (not one shared type with a
// per-instance toolbox colour override, which Blockly doesn't actually
// apply — bl-oq-ly#6) gives every block its category's own colour reliably,
// since Blockly always honours setStyle() called from a block's own init().
//
// Directional connections (bl-oq-ly#11, corrected bl-oq-ly#15): encodes the
// subset of oq's real join-legality engine (morphotactics.js's canFollow())
// that's always true regardless of which specific morpheme is involved,
// structurally, via Blockly's own connection system:
//   - a stem is always the leftmost morpheme (canFollow: "a stem can only
//     begin a word") -- no previousConnection at all.
//   - a particle is a free-standing word: it can only be the SOLE item of a
//     sequence, nothing may precede or follow it, not even another particle
//     -- no previousConnection AND no nextConnection.
//   - a plain enclitic seals the word against ordinary affixes. Another
//     enclitic-family morpheme may still follow, so its next check is
//     ENCLITIC_FOLLOW rather than "nothing" (a null next throws when a plan
//     connects a legal follower).
// An ordinary WORD_FINAL inflectional ending does NOT get this treatment
// (an earlier version of this file wrongly disabled its nextConnection too)
// -- morphotactics.js's CLOSED_BYPASS_TYPES explicitly allows an enclitic or
// derivational_enclitic to attach onto an already-closed word, e.g. a
// finite verb ending followed by an enclitic, a real and common
// construction. A derivational_enclitic keeps both connections for the same
// reason it's exempt from CLOSED_BYPASS_TYPES's usual sealing: grammarian's
// own schema documents it as NOT closing the word, so further affixes/
// endings can still follow.
//
// What this deliberately does NOT encode: category_shift's N/V typed pipe
// (a derivational affix's input class must match the running word's current
// class, and its output class becomes the new running class), or the
// separate valency-scale compatibility checks (semanticCompatibility()).
// Both are real, well-structured rules -- worth a proper typed-connector
// treatment (Blockly connection `check` arrays keyed on N/V, rather than
// the single shared "MORPHEME_CHAIN" string every category uses today) if
// this ever becomes a second pass, but that's a materially bigger change:
// the check would need to be per-PRESET (derived from that preset's own
// category_shift), not per-CATEGORY like everything here, since e.g.
// "Derivational affixes" mixes N->V, V->N, N->N, and V->V entries. Until
// then, buildWord() reports the wrong-word-class case live once a stack is
// built, same as any other join-legality rejection.

import { buildVerbEndingIndex } from "./verb-endings.js";
import { buildNounEndingIndex, nounCandidatesFor, parseNominalCoordinate } from "./noun-endings.js";
import { withInitialCapital } from "./sentence-plan.js";
import { t } from "./i18n.js";
import { canvasIdTree, sameIdTree } from "./id-tree.js";
import {
	VERB_ENDING_PICKER_TYPE, VERB_MOOD_TYPE, VERB_SUBJECT_TYPE, VERB_OBJECT_TYPE,
	defineVerbEndingPickerBlock, defineVerbObjectBlock, registerVerbPickerReactivity, restoreVerbPickerFields,
	bindVerbPickerHost, bindVerbPickerCatalog, reresolveBoundVerbPickers,
} from "./verb-picker.js";

bindVerbPickerHost({ labelFor, applyChainConnections });

// Remaining Blockly connection checks (structural only). Join legality —
// whether this stem may take that affix — stays in buildWord(), never here:
//   WORD_START     — Word MORPHEMES socket; stem/particle previous (cannot follow)
//   MORPHEME_CHAIN — ordinary affix previous/next inside a word
//   WORD_CHAIN     — Word stacking inside a Sentence
//   VERB_MOOD / VERB_SUBJECT / VERB_OBJECT — picker value sockets
// Category hasPrevious/hasNext in CATEGORY_ORDER encodes: stem cannot follow,
// particle is alone. A plain enclitic does not use hasNext: false — that
// threw when a legal enclitic followed. Its next check is ENCLITIC_FOLLOW.
const CONNECTION_TYPE = "MORPHEME_CHAIN";
const ENCLITIC_FOLLOW = "ENCLITIC_FOLLOW";
const WORD_START_CONNECTION_TYPE = "WORD_START";
const WORD_CHAIN_CONNECTION_TYPE = "WORD_CHAIN";
/** A picker with no catalog match. Kept in the chain so buildWord fails closed instead of dropping the ending. */
export const UNRESOLVED_MORPHEME_ID = "bloq:unresolved";
const BLOCK_TYPE_PREFIX = "morpheme_block__";
const ROW_TYPE = `${BLOCK_TYPE_PREFIX}word_row`;
const ROW_CONNECTION = "WORD_ROW";
const WORD_CONTAINER_TYPE = `${BLOCK_TYPE_PREFIX}word_container`;
const SENTENCE_CONTAINER_TYPE = `${BLOCK_TYPE_PREFIX}sentence_container`;
const NOUN_ENDING_PICKER_TYPE = `${BLOCK_TYPE_PREFIX}noun_ending_picker`;
const MISSING_MORPHEME_TYPE = `${BLOCK_TYPE_PREFIX}missing`;
const INFLECTION_BLOCK_STYLE = "oq_inflectional_blocks";
const UI_INDENT = "\u00a0\u00a0\u00a0\u00a0";
const NOUN_PRESENTATION_OPTIONS = [
	["singular · indefinite", "singular|indefinite"],
	["singular · definite", "singular|definite"],
	["plural · indefinite", "plural|indefinite"],
	["plural · definite", "plural|definite"],
];

// grammarian's lexical_facts.morpheme_type enum (verified against the live
// published catalog — see README's "Morpheme catalog" note). Order here is
// the toolbox category order, roughly composition order (stem first).
// hasPrevious/hasNext default to true when omitted.
const CATEGORY_ORDER = [
	{ key: "stem", wordClass: "N", id: "stem_n", name: "Stems — nouns", colourClass: "oq_nominal", hasPrevious: false },
	{ key: "stem", wordClass: "V", id: "stem_v", name: "Stems — verbs", colourClass: "oq_verbal", hasPrevious: false },
	{ key: "stem", wordClass: "", id: "stem_other", name: "Stems — other", colourClass: "oq_neutral", hasPrevious: false },
	{ key: "derivational_prefix", id: "deriv_prefix", name: "Derivational prefixes", colourClass: "oq_derivational" },
	{ key: "derivational_affix", id: "deriv_affix", name: "Derivational affixes", colourClass: "oq_derivational" },
	{ key: "inflectional_ending", id: "inflection", name: "Inflectional endings", colourClass: "oq_inflectional" },
	{ key: "enclitic", id: "enclitic", name: "Enclitics", colourClass: "oq_enclitic" },
	{ key: "derivational_enclitic", id: "deriv_enclitic", name: "Derivational enclitics", colourClass: "oq_enclitic" },
	{ key: "sentential_affix", id: "sentential", name: "Sentential affixes", colourClass: "oq_inflectional" },
	{ key: "particle", id: "particle", name: "Particles", colourClass: "oq_neutral", hasPrevious: false, hasNext: false },
];
const FALLBACK_CATEGORY = { key: "other", id: "other", name: "Other", colourClass: "oq_neutral" };

// Stack is the live workshop (previous/next, top to bottom). Horizontal and
// wrap keep the same blocks, but a word reads left to right through value
// plugs. Wrap breaks that row once it is wider than the canvas.
let viewLayout = "stack";

export function getViewLayout() {
	return viewLayout;
}

export function setViewLayout(layout) {
	viewLayout = layout === "horizontal" || layout === "wrap" ? layout : "stack";
}

function sideBySide() {
	return viewLayout !== "stack";
}

function categoryForPreset(preset) {
	const wordClass = preset.word_class || "";
	const match = CATEGORY_ORDER.find((c) =>
		c.key === preset.morpheme_type && (c.wordClass === undefined || c.wordClass === wordClass));
	if (match) return match;
	// Stem rows are N, then V, then "" ("Stems — other"). A class that is
	// none of those must not fall through to the first stem row (nouns).
	if (preset.morpheme_type === "stem") {
		return CATEGORY_ORDER.find((c) => c.key === "stem" && c.wordClass === "") ?? FALLBACK_CATEGORY;
	}
	return CATEGORY_ORDER.find((c) => c.key === preset.morpheme_type) ?? FALLBACK_CATEGORY;
}

function blockTypeForCategory(cat) {
	return BLOCK_TYPE_PREFIX + cat.id;
}

/**
 * The actual Kalaallisut spelling (declared/citation form, with its
 * +/-/± marker) always shows on the block by default — that's real
 * language, not "linguist speak", and it's a different thing entirely from
 * grammarian's own internal id (e.g. "N_qaq_Vb", "V_IND_INTR_1SG"), which
 * happens to equal the spelling for a plain stem (its id IS its citation
 * form) but is an opaque code for everything else. `opts.spellingMode` can
 * hide it (or hide the gloss instead) for a learner who wants to test their
 * own recall in one direction; `opts.showIds` toggles the opaque internal id
 * on top of whichever of those is showing.
 *
 * A mood-marking morpheme's gloss also bakes its own moodLabel ("statement",
 * "question", ...) into the string with the same em-dash join as everything
 * else; unlike Deconstruct's breakdown view (which keeps it as a small
 * separate tag), blocks drop it entirely -- bl-oq-ly#14, there's no room for
 * a second annotation on an already-compact block label.
 *
 * @param {any} preset
 * @param {{ showIds?: boolean, lang?: "en"|"da", spellingMode?: "both"|"spelling-only"|"gloss-only" }} [opts]
 *   bl-oq-ly#10 (showIds), #17 (lang, spellingMode)
 */
// grammarian's own CLAUDE.md: "en_short and da_short may be legacy strings
// or context maps keyed by English/Danish realization contexts such as
// default, third_singular, and gerund; typed placeholders such as
// {{verb:3sg}} inflect the head verb of a composed phrase." A toolbox
// label works from a bare preset, not a built sequence, so there's no real
// realization context to pick here (unlike glossSummaryItems, which
// resolves this properly against the actual sequence being built) -- this
// always takes the map's own "default" entry, a reasonable citation-form
// stand-in, same as showing a stem's bare dictionary form.
function plainStringGloss(value) {
	if (typeof value === "string") return value;
	if (value && typeof value === "object") return value.default ?? Object.values(value)[0];
	return undefined;
}

export function labelFor(preset, opts = {}) {
	const { showIds = false, lang = "en", spellingMode = "both" } = opts;
	const glossLang = lang === "both" ? "en" : lang;
	const spelling = preset.expected || preset.id;
	const moodLabel = preset.plainGloss?.[`${glossLang}_mood_label`];
	// Danish glosses aren't populated on every entry yet (grammarian's own
	// rollout is ongoing) — fall back to English rather than show nothing.
	const rawGloss = plainStringGloss(preset.plainGloss?.[`${glossLang}_short`])
		?? (glossLang === "da" ? plainStringGloss(preset.plainGloss?.da) : null)
		?? preset.glossShort ?? preset.gloss ?? t("noGloss");
	const gloss = moodLabel && rawGloss.startsWith(`${moodLabel} — `) ? rawGloss.slice(moodLabel.length + 3) : rawGloss;
	const otherGloss = lang === "both"
		? plainStringGloss(preset.plainGloss?.da_short) ?? plainStringGloss(preset.plainGloss?.da)
		: null;
	const displayGloss = otherGloss && otherGloss !== gloss ? `${gloss} / ${otherGloss}` : gloss;

	const core = spellingMode === "spelling-only" ? spelling
		: spellingMode === "gloss-only" ? displayGloss
			: `${spelling} — ${displayGloss}`;
	// The morpheme is the useful learner-facing identity, so keep its form at
	// the start of the label whenever spellingMode includes it. Internal API
	// ids are optional diagnostics and belong at the end; putting them first
	// lets Blockly's compact-label truncation hide the actual Kalaallisut form
	// behind an opaque code.
	const maxLength = 60;
	if (!showIds) return core.slice(0, maxLength);
	const suffix = ` — ${preset.id}`;
	const available = maxLength - suffix.length;
	if (available <= 1) return `${spelling}${suffix}`.slice(0, maxLength);
	const visibleCore = core.length > available ? `${core.slice(0, available - 1)}…` : core;
	return `${visibleCore}${suffix}`;
}

/**
 * Whether a catalog preset matches the Build-palette query. Search the same
 * learner-facing surface data the block can display, not only oq's internal
 * id and English gloss. In particular, the ordinary negator is spelled
 * `-nngit` but has the API id `V_ngngit_Vb`; an id-only search silently hid
 * the exact morpheme a learner typed.
 *
 * @param {any} preset
 * @param {string} query
 */
export function presetMatchesQuery(preset, query) {
	const q = String(query ?? "").trim().toLowerCase();
	if (!q) return true;
	const plainGloss = preset?.plainGloss ?? {};
	const searchable = [
		preset?.id,
		preset?.expected,
		...(Array.isArray(preset?.searchForms) ? preset.searchForms : []),
		preset?.glossShort,
		preset?.gloss,
		plainStringGloss(plainGloss.en_short),
		plainGloss.en,
		plainStringGloss(plainGloss.da_short),
		plainGloss.da,
	];
	return searchable.some((value) => typeof value === "string" && value.toLowerCase().includes(q));
}

/** Registers one Blockly block type per category, each with that category's own colour and connection shape. */
export function defineMorphemeBlocks() {
	// Word and Sentence are the only canvas roots. Word is a C-shaped statement
	// wrapper: morphemes snap INTO it, stem-first. Sentence wraps Word blocks.
	Blockly.Blocks[WORD_CONTAINER_TYPE] = {
		init() {
			// Title row carries the translation label so the statement C stays open
			// at the bottom (no sealing END dummy after MORPHEMES).
			this.appendDummyInput("TITLE_ROW")
				.appendField(new Blockly.FieldLabelSerializable("Word"), "TITLE")
				.appendField(new Blockly.FieldLabelSerializable(""), "TRANSLATION");
			if (viewLayout === "wrap") {
				this.appendStatementInput("ROWS").setCheck(ROW_CONNECTION);
			} else if (viewLayout === "horizontal") {
				this.appendValueInput("MORPHEMES").setCheck(WORD_START_CONNECTION_TYPE);
				this.setInputsInline(true);
			} else {
				this.appendStatementInput("MORPHEMES").setCheck(WORD_START_CONNECTION_TYPE);
			}
			this.setPreviousStatement(true, WORD_CHAIN_CONNECTION_TYPE);
			this.setNextStatement(true, WORD_CHAIN_CONNECTION_TYPE);
			this.setStyle("bloq_word_container_blocks");
			this.setTooltip("A single word built from a chain of morphemes");
		},
	};
	Blockly.Blocks[SENTENCE_CONTAINER_TYPE] = {
		init() {
			// Title row carries the translation label so the statement C stays open
			// at the bottom (no sealing END dummy after WORDS). A sentence is a
			// root: no previous/next, so it cannot snap inside another sentence
			// or onto a word. WORD_CHAIN is only for words.
			this.appendDummyInput("TITLE_ROW")
				.appendField(new Blockly.FieldLabelSerializable("Sentence"), "TITLE")
				.appendField(new Blockly.FieldLabelSerializable(""), "TRANSLATION");
			this.appendStatementInput("WORDS")
				.setCheck(WORD_CHAIN_CONNECTION_TYPE);
			this.setStyle("bloq_sentence_container_blocks");
			this.setTooltip("A sentence built from a sequence of words");
		},
	};
	Blockly.Blocks[ROW_TYPE] = {
		init() {
			this.appendValueInput("CHAIN");
			this.setPreviousStatement(true, ROW_CONNECTION);
			this.setNextStatement(true, ROW_CONNECTION);
			this.setInputsInline(true);
			this.setStyle("bloq_word_container_blocks");
			this.setTooltip("One line of a left-to-right word");
		},
	};
	Blockly.Blocks[MISSING_MORPHEME_TYPE] = {
		init() {
			this.appendDummyInput().appendField(new Blockly.FieldLabelSerializable(""), "LABEL");
			this.setStyle(INFLECTION_BLOCK_STYLE);
			// An absent preset has no known connection category. Retain its
			// position and ID so Build rejects the whole chain visibly.
			if (sideBySide()) {
				this.setOutput(true);
				this.appendValueInput("NEXT");
				this.setInputsInline(true);
			} else {
				this.setPreviousStatement(true);
				this.setNextStatement(true);
			}
		},
	};
	for (const cat of [...CATEGORY_ORDER, FALLBACK_CATEGORY]) {
		Blockly.Blocks[blockTypeForCategory(cat)] = {
			init() {
				this.appendDummyInput()
					.appendField(new Blockly.FieldLabelSerializable(""), "LABEL");
				if (cat.id === "stem_n") {
					this.appendDummyInput("PRESENTATION")
						.appendField(`${UI_INDENT}translation`)
						.appendField(new Blockly.FieldDropdown(NOUN_PRESENTATION_OPTIONS), "PRESENTATION");
				}
				this.setStyle(`${cat.colourClass}_blocks`);
				applyChainConnections(this, cat);
			},
		};
	}
}

/** Check for a wrap row's CHAIN socket. The row must keep the previous morpheme's NEXT check, or a line break would let an ordinary affix follow a plain enclitic. */
export function wrapRowChainCheck(previousNextCheck, wordStart) {
	if (wordStart) return WORD_START_CONNECTION_TYPE;
	return previousNextCheck || CONNECTION_TYPE;
}

function previousCheckFor(cat) {
	if (cat.hasPrevious === false) return WORD_START_CONNECTION_TYPE;
	if (cat.key === "enclitic" || cat.key === "derivational_enclitic") return [CONNECTION_TYPE, ENCLITIC_FOLLOW];
	return CONNECTION_TYPE;
}

function nextCheckFor(cat) {
	if (cat.hasNext === false) return null;
	if (cat.key === "enclitic") return ENCLITIC_FOLLOW;
	return CONNECTION_TYPE;
}

function applyChainConnections(block, cat, { inline = true } = {}) {
	const prevCheck = previousCheckFor(cat);
	const nextCheck = nextCheckFor(cat);
	if (!sideBySide()) {
		block.setPreviousStatement(true, prevCheck);
		block.setNextStatement(Boolean(nextCheck), nextCheck);
		return;
	}
	block.setOutput(true, prevCheck);
	if (nextCheck) block.appendValueInput("NEXT").setCheck(nextCheck);
	if (inline) block.setInputsInline(true);
}

function isMorphemeBlockType(type) {
	// VERB_OBJECT_TYPE shares this module's block-type prefix (it's still a
	// morpheme-adjacent block) but is never itself a chain link -- it's a
	// value block that only ever plugs sideways into a picker's OBJECT_SLOT.
	// Left unplugged and sitting loose on the canvas, it must not register as
	// a word chain in topLevelSentences().
	return typeof type === "string" && type.startsWith(BLOCK_TYPE_PREFIX)
		&& ![WORD_CONTAINER_TYPE, SENTENCE_CONTAINER_TYPE, ROW_TYPE, VERB_MOOD_TYPE, VERB_SUBJECT_TYPE, VERB_OBJECT_TYPE].includes(type);
}

function isNounEndingPreset(preset) {
	return Boolean(parseNominalCoordinate(preset)) && !isVerbEndingPreset(preset);
}

function isZeroEndingPreset(preset) {
	return preset?.morpheme_type === "inflectional_ending"
		&& (preset.expected === "Ø" || preset.seq?.[0]?.text === "" || preset.seq?.[0]?.text === "Ø");
}

// Same reason as verbCatalog: the noun picker type is defined once, and a
// catalog refresh has to change which endings that type resolves to.
const nounCatalog = {
	index: null,
	presetsById: new Map(),
	getDisplayOptions: () => ({}),
};

/**
 * @param {{
 *   nounEndingIndex?: ReturnType<typeof buildNounEndingIndex>,
 *   presetsById?: Map<string, any>,
 *   getDisplayOptions?: () => object,
 * }} [next]
 */
export function bindNounPickerCatalog(next = {}) {
	if (next.nounEndingIndex) nounCatalog.index = next.nounEndingIndex;
	if (next.presetsById) nounCatalog.presetsById = next.presetsById;
	if (typeof next.getDisplayOptions === "function") nounCatalog.getDisplayOptions = next.getDisplayOptions;
}

/** Re-run resolve on noun pickers already on the canvas after a catalog swap. */
export function reresolveBoundNounPickers(workspace) {
	if (!workspace?.getAllBlocks) return;
	for (const block of workspace.getAllBlocks(false)) {
		if (block.type === NOUN_ENDING_PICKER_TYPE) block.nounEndingPickerState?.resolve?.();
	}
}

/** Candidates for one nominal coordinate against the catalog bound now. */
export function nounPickerCandidates(caseName, possessor = "none", number = "SG") {
	return nounCandidatesFor(nounCatalog.index, caseName, possessor, number);
}

function nounAxisMenu(axis) {
	const values = nounCatalog.index?.[axis] ?? [];
	return values.length ? values.map((value) => [value, value]) : [["—", "NONE"]];
}

export function defineNounEndingPickerBlock(nounEndingIndex, presetsById, getDisplayOptions) {
	bindNounPickerCatalog({ nounEndingIndex, presetsById, getDisplayOptions });
	const resolveFor = (block, override) => {
		const state = block.nounEndingPickerState;
		const pending = { ...(state.pending || {}), ...(override || {}) };
		state.pending = pending;
		try {
			// Validators run before the new value is stored. Read the in-flight
			// axis from this call instead of getFieldValue, which is still the
			// previous coordinate. A nested VARIANT setValue must keep that
			// pending axis or it writes the old case/number back into block.data.
			const caseName = pending.CASE ?? block.getFieldValue("CASE");
			const possessor = pending.POSSESSOR ?? block.getFieldValue("POSSESSOR");
			const number = pending.NUMBER ?? block.getFieldValue("NUMBER");
			const candidates = nounCandidatesFor(nounCatalog.index, caseName, possessor, number);
			state.candidates = candidates.map((c) => [c.label.slice(0, 70), c.id]);
			const currentVariant = pending.VARIANT ?? block.getFieldValue("VARIANT");
			const stillValid = candidates.some((c) => c.id === currentVariant);
			const id = stillValid ? currentVariant : candidates[0]?.id ?? null;
			block.data = id;
			const preset = id ? nounCatalog.presetsById.get(id) : null;
			block.getField("RESOLVED")?.setValue(preset ? labelFor(preset, nounCatalog.getDisplayOptions()) : t("noSuchEnding"));
			if (block.rendered) block.render();
			const axisChange = override && override.VARIANT === undefined
				&& (override.CASE !== undefined || override.POSSESSOR !== undefined || override.NUMBER !== undefined);
			const variantField = block.getField("VARIANT");
			if (axisChange && !stillValid && variantField && id) {
				state.pending = { ...pending, VARIANT: id };
				variantField.getOptions(false);
				variantField.setValue(id);
			}
			return id;
		} finally {
			state.pending = null;
		}
	};
	Blockly.Blocks[NOUN_ENDING_PICKER_TYPE] = {
		init() {
			this.nounEndingPickerState = { candidates: [] };
			this.appendDummyInput("RESOLVED").appendField(new Blockly.FieldLabelSerializable(""), "RESOLVED");
			const changed = function (newValue) {
				const block = this.getSourceBlock();
				if (block) resolveFor(block, { [this.name]: newValue });
				return newValue;
			};
			this.appendDummyInput().appendField(`${UI_INDENT}Case`).appendField(new Blockly.FieldDropdown(() => nounAxisMenu("cases"), changed), "CASE");
			this.appendDummyInput().appendField(`${UI_INDENT}Possessor`).appendField(new Blockly.FieldDropdown(() => nounAxisMenu("possessors"), changed), "POSSESSOR");
			this.appendDummyInput().appendField(`${UI_INDENT}Number`).appendField(new Blockly.FieldDropdown(() => nounAxisMenu("numbers"), changed), "NUMBER");
			this.appendDummyInput("VARIANT").appendField(`${UI_INDENT}Variant`).appendField(new Blockly.FieldDropdown(function () { return this.getSourceBlock()?.nounEndingPickerState?.candidates ?? [["—", "NONE"]]; }, changed), "VARIANT");
			this.setStyle(INFLECTION_BLOCK_STYLE);
			this.setInputsInline(false);
			this.nounEndingPickerState.resolve = () => resolveFor(this);
			applyChainConnections(this, { hasNext: true }, { inline: false });
			resolveFor(this);
		},
	};
}

export {
	VERB_ENDING_PICKER_TYPE, VERB_MOOD_TYPE, VERB_SUBJECT_TYPE, VERB_OBJECT_TYPE,
	defineVerbEndingPickerBlock, defineVerbObjectBlock, registerVerbPickerReactivity, restoreVerbPickerFields,
	bindVerbPickerCatalog, reresolveBoundVerbPickers,
};

/** True when `preset` is a real verb-mood inflectional ending -- one of the
 * ~278 entries carrying a structured `inflection.subject` (paradigm
 * coordinates), as opposed to a case/possession ending or anything else.
 * Shared by buildToolbox() (which excludes these from the flat list) and
 * renderSentencePlan() (which needs to know to build a picker instance, not a
 * plain block, for one of these) so the two conditions can't drift apart. */
function isVerbEndingPreset(preset) {
	return preset.morpheme_type === "inflectional_ending" && Boolean(preset.seq?.[0]?.inflection?.subject);
}


/**
 * Builds a categorized Blockly toolbox from (optionally filtered) presets.
 * A category with no matching presets is omitted entirely, which is what
 * makes the Build-panel filter box (app.js) feel live: typing narrows which
 * categories even appear, not just their contents. The verb ending picker
 * (bl-oq-ly#18) replaces every individual mood-ending entry in "Inflectional
 * endings" with one picker block at the top of that category; the ~77
 * remaining non-paradigm entries (case/possession endings with no
 * `inflection` block) still list individually, same as any other category.
 *
 * The picker has no id/gloss text of its own to match against a filter
 * query, so it only appears in the unfiltered view (`includeVerbPicker`,
 * true by default). While a filter is active the matching verb and noun
 * endings are ordinary blocks again — hiding the picker must not hide the
 * endings it replaced.
 */
export function buildToolbox(presets, displayOptions = {}, { includeVerbPicker = true } = {}) {
	const byCategoryName = new Map();
	const hasStructuredNounEndings = presets.some((preset) => !isZeroEndingPreset(preset) && isNounEndingPreset(preset));
	const omittedByCategory = new Map();
	for (const preset of presets) {
		if (isZeroEndingPreset(preset)) continue;
		// Pickers replace paradigm entries only when they are actually shown.
		// A filtered toolbox hides the pickers (they have no gloss to match);
		// the endings themselves still have forms and must come back as blocks.
		const coveredByPicker = includeVerbPicker && (isVerbEndingPreset(preset) || isNounEndingPreset(preset));
		if (coveredByPicker) {
			omittedByCategory.set("Inflectional endings", (omittedByCategory.get("Inflectional endings") ?? 0) + 1);
			continue;
		}
		const cat = categoryForPreset(preset);
		if (!byCategoryName.has(cat.name)) byCategoryName.set(cat.name, { ...cat, presets: [] });
		byCategoryName.get(cat.name).presets.push(preset);
	}

	const contents = [...CATEGORY_ORDER, FALLBACK_CATEGORY]
		.map((c) => c.name)
		.filter((name, i, arr) => arr.indexOf(name) === i)
		.filter((name) => byCategoryName.has(name) || (includeVerbPicker && name === "Inflectional endings"))
		.map((name) => {
			const cat = byCategoryName.get(name) ?? { ...CATEGORY_ORDER.find((c) => c.name === name), presets: [] };
			const blockType = blockTypeForCategory(cat);
			const blocks = cat.presets
				.slice()
				.sort((a, b) => a.id.localeCompare(b.id))
				.map((preset) => ({
					kind: "block",
					type: blockType,
					data: preset.id,
					fields: { LABEL: labelFor(preset, displayOptions) },
				}));
			if (name === "Inflectional endings" && includeVerbPicker) {
				// Mood, polarity, and subject are fields on the ending itself:
				// they jointly select one API realization and have no independent
				// meaning elsewhere in the current word builder. Object remains
				// a separate typed block because its presence changes valency.
				blocks.unshift({ kind: "block", type: VERB_ENDING_PICKER_TYPE });
				// Keep the established verb picker first: existing users/tests can
				// drag the first entry for the common verb workflow. Add the nominal
				// picker immediately after it, then the object block.
				if (hasStructuredNounEndings) blocks.splice(1, 0, { kind: "block", type: NOUN_ENDING_PICKER_TYPE });
				const afterPickers = 1 + (hasStructuredNounEndings ? 1 : 0);
				blocks.splice(afterPickers, 0, { kind: "block", type: VERB_OBJECT_TYPE });
			}
			return {
				kind: "category",
				name: omittedByCategory.has(cat.name)
					? `${cat.name} (${cat.presets.length + omittedByCategory.get(cat.name)} entries · ${blocks.length} blocks)`
					: `${cat.name} (${blocks.length})`,
				categorystyle: `${cat.colourClass}_category`,
				contents: blocks,
			};
		});

	contents.push({
		kind: "category",
		name: "Words (1)",
		categorystyle: "oq_container_category",
		contents: [{ kind: "block", type: WORD_CONTAINER_TYPE }],
	});
	contents.push({
		kind: "category",
		name: "Sentences (1)",
		categorystyle: "oq_container_category",
		contents: [{ kind: "block", type: SENTENCE_CONTAINER_TYPE }],
	});
	return { kind: "categoryToolbox", contents };
}

/**
 * Single canvas walker. Workspace → tree of sentences/words with ids, held
 * flags, and owning blocks. wordsFromBlock / topLevelSentences /
 * labelContainers / planFromCanvas are views over this tree.
 *
 * @param {any} workspace
 * @returns {{ sentences: Array<{ block: any, words: Array<{ ids: string[], held: string|null, block: any }> }> }}
 */
function collectChainedWords(start) {
	const words = [];
	const seen = new Set();
	let cur = start;
	while (cur && !seen.has(cur)) {
		seen.add(cur);
		if (cur.type === WORD_CONTAINER_TYPE) {
			const held = cur.bloqHeld || null;
			const ids = held ? [] : idsInsideWord(cur);
			if (held || ids.length) words.push({ ids, held, block: cur });
		} else if (isMorphemeBlockType(cur.type)) {
			const ids = morphemeIdsFrom(cur);
			if (ids.length) words.push({ ids, held: null, block: cur });
			break;
		}
		cur = cur.getNextBlock?.() || null;
	}
	return words;
}

export function canvasTree(workspace) {
	const sentences = [];
	for (const top of workspace.getTopBlocks(true)) {
		if (top.type === SENTENCE_CONTAINER_TYPE) {
			// Keep the container even when WORDS is empty. Dropping it makes a
			// theme or layout switch erase a Sentence that was just placed.
			const words = collectChainedWords(top.getInputTargetBlock?.("WORDS"));
			sentences.push({ block: top, words });
			continue;
		}
		if (top.type === WORD_CONTAINER_TYPE) {
			// A word snapped onto another word is not its own top block.
			// Follow the chain or the tail never reaches the reading line.
			const words = collectChainedWords(top);
			if (words.length) sentences.push({ block: null, words });
			continue;
		}
		if (isMorphemeBlockType(top.type)) {
			const ids = morphemeIdsFrom(top);
			if (ids.length) sentences.push({ block: null, words: [{ ids, held: null, block: top }] });
		}
	}
	return { sentences };
}

/**
 * Layout and theme snapshot. A Sentence block stays a sentence: source comes
 * from bloqSource, else the title field, else "Sentence", including when the
 * container is empty or holds one word. A bare Word chain has no sentence
 * block, so it stays on the simple render path.
 * @param {any} workspace
 */
export function planFromCanvas(workspace) {
	return canvasTree(workspace).sentences.map((sentence) => {
		const block = sentence.block;
		const sentenceBlock = block?.type === SENTENCE_CONTAINER_TYPE ? block : null;
		return {
			source: sentenceBlock
				? (sentenceBlock.bloqSource || sentenceBlock.getFieldValue?.("TITLE") || "Sentence")
				: block?.bloqSource,
			// Never re-stamp stale assembly onto a layout/theme rebuild.
			assembly: assemblyKeyMatches(block, sentence.words.filter((word) => !word.held).map((word) => word.ids), sentence.words) ? block.bloqAssembly : undefined,
			words: sentence.words.map((word) => {
				if (word.held) {
					return { surface: word.block?.getFieldValue?.("TITLE") || "…", heldLabel: word.held };
				}
				const presentation = nounStemBlock(word.block)?.getFieldValue?.("PRESENTATION");
				return {
					canvasIds: word.ids.slice(),
					...(presentation ? { presentation } : {}),
				};
			}),
		};
	});
}

function morphemeIdsFrom(block) {
	const ids = [];
	const seen = new Set();
	let cur = block;
	while (cur && !seen.has(cur)) {
		seen.add(cur);
		if (isMorphemeBlockType(cur.type)) ids.push(cur.data || UNRESOLVED_MORPHEME_ID);
		// Horizontal pieces plug into NEXT. Stack pieces use getNextBlock.
		// A fake test block has only one of the two. A cycle must stop:
		// nounStemBlock and collectChainedWords already do.
		const next = cur.getInputTargetBlock?.("NEXT");
		cur = next || cur.getNextBlock?.() || null;
	}
	return ids;
}

function idsInsideWord(block) {
	if (block.getInput?.("ROWS")) {
		const ids = [];
		let row = block.getInputTargetBlock?.("ROWS");
		while (row) {
			ids.push(...morphemeIdsFrom(row.getInputTargetBlock?.("CHAIN")));
			row = row.getNextBlock?.() || null;
		}
		return ids;
	}
	return morphemeIdsFrom(block.getInputTargetBlock?.("MORPHEMES"));
}

/** The noun stem block inside a word, including a wrap layout's ROWS → CHAIN. */
export function nounStemBlock(block) {
	if (!block) return null;
	if (block.type === `${BLOCK_TYPE_PREFIX}stem_n`) return block;
	if (block.getInput?.("ROWS")) {
		let row = block.getInputTargetBlock?.("ROWS");
		while (row) {
			const stem = nounStemBlock(row.getInputTargetBlock?.("CHAIN"));
			if (stem) return stem;
			row = row.getNextBlock?.() || null;
		}
		return null;
	}
	const start = block.type === WORD_CONTAINER_TYPE ? block.getInputTargetBlock?.("MORPHEMES") : block;
	let cur = start;
	const seen = new Set();
	while (cur && !seen.has(cur)) {
		seen.add(cur);
		if (cur.type === `${BLOCK_TYPE_PREFIX}stem_n`) return cur;
		const next = cur.getInputTargetBlock?.("NEXT");
		cur = next || cur.getNextBlock?.() || null;
	}
	return null;
}

function paintPresentation(block, presentation) {
	if (!presentation) return;
	nounStemBlock(block)?.setFieldValue?.(presentation, "PRESENTATION");
}

function paintWordPresentations(first, words) {
	let block = first;
	for (const word of words ?? []) {
		if (!block) return;
		paintPresentation(block, word.presentation);
		block = block.getNextBlock?.() || null;
	}
}

/**
 * Collects each word (array of morpheme ids) under `block`. A Sentence
 * unwraps to its contained Word stack; stacked Word containers each yield
 * one word; a loose morpheme chain is treated as a single word.
 */
export function wordsFromBlock(block) {
	if (!block) return [];
	if (block.type === SENTENCE_CONTAINER_TYPE || block.type === WORD_CONTAINER_TYPE || isMorphemeBlockType(block.type)) {
		const tree = canvasTree({ getTopBlocks: () => [block] });
		return tree.sentences[0]?.words.filter((w) => !w.held).map((w) => w.ids) ?? [];
	}
	return [];
}

/** Every top-level sentence currently on the workspace, each as an array of word-chains. */
export function topLevelSentences(workspace) {
	return canvasIdTree(canvasTree(workspace)).filter((words) => words.length > 0);
}

function clearCanvasBlocks(workspace) {
	for (const block of workspace.getTopBlocks(false)) block.dispose(false);
}

function withBlocklyEventsDisabled(fn) {
	const events = globalThis.Blockly?.Events;
	events?.disable?.();
	try {
		return fn();
	} finally {
		events?.enable?.();
	}
}

function isSimpleDrawablePlan(sentences) {
	if (sentences.length !== 1) return false;
	const item = sentences[0];
	if (item.source || item.assembly) return false;
	const words = item.words ?? [];
	if (!words.length) return false;
	return words.every((word) => (word.canvasIds ?? []).filter(Boolean).length && !word.heldLabel);
}

/**
 * Sole public canvas renderer (share-link restore and Deconstruct).
 * Sentence-plan items in → blocks out, including held (non-drawable) words.
 * A single simple drawable word stays a lone Word container; richer plans
 * always use Sentence containers. Blockly change events are suppressed for
 * the duration so callers can own URL / mode sync without a timeout flag.
 *
 * @param {Array<{ source?: string, assembly?: string, words?: Array<{ surface?: string, raw?: string, canvasIds?: string[], heldLabel?: string }> }>} sentences
 * @param {{ forceSentence?: boolean }} [options]
 */
export function renderSentencePlan(workspace, sentences, presetsById, displayOptions, { forceSentence = false } = {}) {
	const list = Array.isArray(sentences) ? sentences : [];
	withBlocklyEventsDisabled(() => {
		clearCanvasBlocks(workspace);
		if (!list.length) return;

		if (!forceSentence && isSimpleDrawablePlan(list)) {
			const chains = list[0].words.map((word) => word.canvasIds.filter(Boolean));
			if (chains.length <= 1) {
				const container = buildWordBlock(workspace, chains[0] ?? [], presetsById, displayOptions);
				paintPresentation(container, list[0].words[0]?.presentation);
				container.moveBy(20, 20);
				return;
			}
			const sentence = workspace.newBlock(SENTENCE_CONTAINER_TYPE);
			sentence.initSvg();
			sentence.render();
			sentence.moveBy(20, 20);
			connectWords(workspace, sentence, chains, presetsById, displayOptions);
			paintWordPresentations(sentence.getInputTargetBlock("WORDS"), list[0].words);
			return;
		}

		let y = 20;
		for (const item of list) {
			const sentence = workspace.newBlock(SENTENCE_CONTAINER_TYPE);
			sentence.bloqSource = item.source || "Sentence";
			sentence.initSvg();
			sentence.render();
			sentence.moveBy(20, y);
			sentence.setFieldValue(sentence.bloqSource, "TITLE");
			const drawable = [];
			let prevWord = null;
			for (const word of item.words ?? []) {
				const ids = (word.canvasIds ?? []).filter(Boolean);
				const wordBlock = ids.length
					? buildWordBlock(workspace, ids, presetsById, displayOptions)
					: buildHeldWord(workspace, !prevWord ? withInitialCapital(word.surface || word.raw) : (word.surface || word.raw), word.heldLabel || "heldNotDrawn");
				if (ids.length) drawable.push(ids);
				if (ids.length) paintPresentation(wordBlock, word.presentation);
				if (prevWord) prevWord.nextConnection.connect(wordBlock.previousConnection);
				else sentence.getInput("WORDS").connection.connect(wordBlock.previousConnection);
				prevWord = wordBlock;
			}
			stampAssembly(sentence, drawable, item.assembly || "", collectChainedWords(sentence.getInputTargetBlock("WORDS")));
			if (item.assembly) sentence.setFieldValue(item.assembly, "TRANSLATION");
			sentence.render();
			const height = sentence.getHeightWidth?.().height ?? 80;
			y += Math.max(height, 72) + 28;
		}
	});
}

function buildHeldWord(workspace, surface, label) {
	const container = workspace.newBlock(WORD_CONTAINER_TYPE);
	const key = label || "heldNotDrawn";
	container.bloqHeld = key;
	container.initSvg();
	container.render();
	container.setFieldValue(surface || "…", "TITLE");
	container.setFieldValue(t(key), "TRANSLATION");
	container.setTooltip(t(key));
	return container;
}

function connectWords(workspace, sentence, words, presetsById, displayOptions) {
	let prevWord = null;
	for (const ids of words) {
		const wordBlock = buildWordBlock(workspace, ids, presetsById, displayOptions);
		if (prevWord) prevWord.nextConnection.connect(wordBlock.previousConnection);
		else sentence.getInput("WORDS").connection.connect(wordBlock.previousConnection);
		prevWord = wordBlock;
	}
}

function heldAssemblyKey(words) {
	return (words || []).flatMap((word, index) => word.held ? [{ index, held: word.held, surface: word.block?.getFieldValue?.("TITLE") }] : []);
}

function stampAssembly(block, words, assembly, allWords) {
	if (!block || !assembly) return;
	block.bloqAssembly = assembly;
	block.bloqAssemblyKey = (words ?? []).map((ids) => ids.slice());
	block.bloqAssemblyHeldKey = heldAssemblyKey(allWords);
}

function assemblyKeyMatches(block, words, allWords) {
	const key = block?.bloqAssemblyKey;
	if (!block?.bloqAssembly || !Array.isArray(key)) return false;
	if (JSON.stringify(block.bloqAssemblyHeldKey || []) !== JSON.stringify(heldAssemblyKey(allWords))) return false;
	return sameIdTree([key], [words ?? []]);
}

function buildWordBlock(workspace, ids, presetsById, displayOptions) {
	const container = workspace.newBlock(WORD_CONTAINER_TYPE);
	container.initSvg();
	container.render();
	if (viewLayout === "wrap") {
		fillWrappedWord(workspace, container, ids, presetsById, displayOptions);
		return container;
	}
	let prev = null;
	for (const id of ids) {
		const block = createMorphemeBlock(workspace, id, presetsById, displayOptions);
		if (sideBySide()) {
			const socket = prev ? prev.getInput("NEXT")?.connection : container.getInput("MORPHEMES")?.connection;
			if (socket && block.outputConnection) socket.connect(block.outputConnection);
		} else if (prev) {
			if (prev.nextConnection) prev.nextConnection.connect(block.previousConnection);
		} else {
			container.getInput("MORPHEMES").connection.connect(block.previousConnection);
		}
		prev = block;
	}
	return container;
}

function fillWrappedWord(workspace, container, ids, presetsById, displayOptions) {
	const max = Math.max(280, (container.workspace?.getParentSvg?.()?.clientWidth || 720) - 260);
	let row = null;
	let prev = null;
	let used = 0;
	for (const id of ids) {
		const block = createMorphemeBlock(workspace, id, presetsById, displayOptions);
		const label = block.getFieldValue("LABEL") || block.getFieldValue("RESOLVED") || id;
		const est = Math.min(240, 56 + String(label).length * 7);
		if (!row || (prev && used + est > max)) {
			const wordStart = !prev;
			const previousNextCheck = prev?.getInput?.("NEXT")?.connection?.getCheck?.() ?? null;
			row = workspace.newBlock(ROW_TYPE);
			row.initSvg();
			row.render();
			row.getInput("CHAIN").setCheck(wrapRowChainCheck(previousNextCheck, wordStart));
			const rows = container.getInput("ROWS").connection;
			const tail = lastStatement(rows.targetBlock());
			if (tail) tail.nextConnection.connect(row.previousConnection);
			else rows.connect(row.previousConnection);
			prev = null;
			used = 0;
		}
		const socket = prev ? prev.getInput("NEXT")?.connection : row.getInput("CHAIN").connection;
		if (socket && block.outputConnection) socket.connect(block.outputConnection);
		prev = block;
		used += est;
	}
}

function lastStatement(block) {
	let cur = block;
	while (cur?.getNextBlock()) cur = cur.getNextBlock();
	return cur;
}

function createMorphemeBlock(workspace, id, presetsById, displayOptions) {
	if (id === UNRESOLVED_MORPHEME_ID) {
		// Theme rebuild goes through the sentence plan, which only has ids.
		// A picker that never resolved must stay a slot or the chain silently
		// shortens. Do not newBlock a real picker: its init resolves a guess.
		const block = workspace.newBlock(`${BLOCK_TYPE_PREFIX}inflection`);
		block.data = null;
		block.initSvg();
		block.render();
		block.setFieldValue("…", "LABEL");
		return block;
	}
	const preset = presetsById.get(id);
	if (!preset) {
		const block = workspace.newBlock(MISSING_MORPHEME_TYPE);
		block.data = id;
		block.setFieldValue(`${t("unknownMorpheme")} ${id}`, "LABEL");
		block.initSvg();
		block.render();
		return block;
	}
	// Toolbox flyouts omit a zero ending (there is nothing to drag). A chain
	// that already names that id must still draw it — dropping it makes the
	// canvas disagree with the analysis. A plain block keeps block.data equal
	// to that id; the noun/verb pickers would resolve it to some other candidate.
	const zero = isZeroEndingPreset(preset);
	const isVerbEnding = !zero && isVerbEndingPreset(preset);
	const isNounEnding = !zero && isNounEndingPreset(preset);
	const block = workspace.newBlock(isVerbEnding ? VERB_ENDING_PICKER_TYPE : isNounEnding ? NOUN_ENDING_PICKER_TYPE : blockTypeForCategory(categoryForPreset(preset)));
	if (!isVerbEnding && !isNounEnding) {
		block.data = id;
		block.setFieldValue(labelFor(preset, displayOptions), "LABEL");
	}
	block.initSvg();
	block.render();
	if (isVerbEnding) restoreVerbPickerFields(workspace, block, preset);
	if (isNounEnding) restoreNounPickerFields(block, preset);
	return block;
}

/**
 * Restore a nominal-ending picker to one catalog id.
 * Case, possessor, and number come from parseNominalCoordinate, including when
 * case lives only on the id. resolve() then keeps VARIANT on the first
 * candidate of that coordinate; a second id (N_ABS_POSS1SG_PL_ARCHAIC) has to
 * be chosen after the dropdown cache is refreshed, or setFieldValue no-ops.
 * @param {any} block
 * @param {any} preset
 */
export function restoreNounPickerFields(block, preset) {
	const coordinate = parseNominalCoordinate(preset);
	if (!coordinate) return;
	block.setFieldValue(coordinate.case, "CASE");
	block.setFieldValue(coordinate.possessor, "POSSESSOR");
	block.setFieldValue(coordinate.number, "NUMBER");
	block.nounEndingPickerState.resolve();
	if (block.data === preset.id) return;
	const variantField = block.getField("VARIANT");
	if (!variantField) return;
	variantField.getOptions(false);
	block.setFieldValue(preset.id, "VARIANT");
	// The validator may have resolved against the previous variant. The
	// field value is committed now, so resolve once more from the field.
	block.nounEndingPickerState.resolve();
}

/** Paints built surface forms and translations onto Word / Sentence containers.
 * Field updates are event-suppressed so a Deconstruct/Build refresh cannot be
 * mistaken for a user canvas edit by the workspace change listener. */
export function labelContainers(workspace, builtWords, translations = []) {
	withBlocklyEventsDisabled(() => {
		const tree = canvasTree(workspace);
		const chainWords = tree.sentences.flatMap((sentence) => sentence.words.filter((word) => !word.held));
		chainWords.forEach((word, i) => {
			const block = word.block;
			if (block?.type !== WORD_CONTAINER_TYPE) return;
			const result = builtWords[i];
			block.setFieldValue(result?.word || "Word", "TITLE");
			block.setFieldValue(translations[i] || "", "TRANSLATION");
			if (block.rendered) block.render();
		});
		const indexByBlock = new Map(chainWords.map((word, i) => [word.block, i]));
		for (const sentence of tree.sentences) {
			const top = sentence.block;
			if (!top || top.type !== SENTENCE_CONTAINER_TYPE) continue;
			const words = sentence.words.map((word) => word.block).filter((block) => block?.type === WORD_CONTAINER_TYPE);
			const first = words[0];
			if (first) {
				const title = first.getFieldValue("TITLE");
				if (title && title !== "Word") first.setFieldValue(withInitialCapital(title), "TITLE");
			}
			const owned = words.map((block) => builtWords[indexByBlock.get(block)]);
			const builtSurface = owned.map((result) => result?.word).filter(Boolean).join(" ");
			const drawableIds = sentence.words.filter((word) => !word.held).map((word) => word.ids);
			const assembled = assemblyKeyMatches(top, drawableIds, sentence.words) ? top.bloqAssembly : null;
			const surface = assembled && top.bloqSource ? top.bloqSource : (builtSurface || top.bloqSource || "Sentence");
			top.setFieldValue(surface === "Sentence" ? surface : withInitialCapital(surface), "TITLE");
			const translation = assembled ?? words
				.map((block) => translations[indexByBlock.get(block)])
				.filter(Boolean)
				.map((text, i) => i === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1))
				.join(" ");
			top.setFieldValue(translation, "TRANSLATION");
			if (top.rendered) top.render();
		}
	});
}

/** Re-labels every morpheme block already on the canvas — used when a display option changes mid-session. */
export function relabelBlocks(workspace, presetsById, displayOptions) {
	for (const block of workspace.getAllBlocks(false)) {
		if (block.type === VERB_ENDING_PICKER_TYPE) {
			block.verbEndingPickerState?.resolve?.()
				?? Blockly.Blocks[VERB_ENDING_PICKER_TYPE].__resolve?.(block);
			continue;
		}
		if (block.type === NOUN_ENDING_PICKER_TYPE) {
			block.nounEndingPickerState?.resolve?.();
			continue;
		}
		if (!isMorphemeBlockType(block.type) || !block.data) continue;
		const preset = presetsById.get(block.data);
		if (preset) block.setFieldValue(labelFor(preset, displayOptions), "LABEL");
	}
}

/**
 * Category-level previous/next shapes for unit tests. These are structural
 * (stem cannot follow, particle is alone, a plain enclitic's next check is
 * ENCLITIC_FOLLOW); join legality stays in buildWord().
 */
export function structuralCategoryConnections() {
	return CATEGORY_ORDER.map((cat) => ({
		id: cat.id,
		key: cat.key,
		wordClass: cat.wordClass ?? null,
		hasPrevious: cat.hasPrevious !== false,
		hasNext: cat.hasNext !== false,
		previousCheck: previousCheckFor(cat),
		nextCheck: nextCheckFor(cat),
	}));
}

export { buildVerbEndingIndex, buildNounEndingIndex, WORD_CONTAINER_TYPE, SENTENCE_CONTAINER_TYPE, NOUN_ENDING_PICKER_TYPE };
