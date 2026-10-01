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
//   - a plain enclitic always seals the word once attached (nothing but
//     another enclitic-family morpheme could follow, and Blockly's static
//     per-category check strings can't express "only these specific
//     categories," so this is drawn conservatively at "nothing") -- no
//     nextConnection.
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

import { buildVerbEndingIndex, candidatesFor, parsePersonNumber, personNumberLabel, moodDisplayLabel } from "./verb-endings.js";
import { buildNounEndingIndex, nounCandidatesFor, parseNominalCoordinate } from "./noun-endings.js";
import { withInitialCapital } from "./sentence-plan.js";
import { t } from "./i18n.js";
import { canvasIdTree, sameIdTree } from "./id-tree.js";

// Remaining Blockly connection checks (structural only). Join legality —
// whether this stem may take that affix — stays in buildWord(), never here:
//   WORD_START     — Word MORPHEMES socket; stem/particle previous (cannot follow)
//   MORPHEME_CHAIN — ordinary affix previous/next inside a word
//   WORD_CHAIN     — Word stacking inside a Sentence
//   VERB_MOOD / VERB_SUBJECT / VERB_OBJECT — picker value sockets
// Category hasPrevious/hasNext in CATEGORY_ORDER encodes: stem cannot follow,
// particle is alone, enclitic seals the chain.
const CONNECTION_TYPE = "MORPHEME_CHAIN";
const WORD_START_CONNECTION_TYPE = "WORD_START";
const WORD_CHAIN_CONNECTION_TYPE = "WORD_CHAIN";
const BLOCK_TYPE_PREFIX = "morpheme_block__";
const ROW_TYPE = `${BLOCK_TYPE_PREFIX}word_row`;
const ROW_CONNECTION = "WORD_ROW";
const VERB_ENDING_PICKER_TYPE = `${BLOCK_TYPE_PREFIX}verb_ending_picker`;
const WORD_CONTAINER_TYPE = `${BLOCK_TYPE_PREFIX}word_container`;
const SENTENCE_CONTAINER_TYPE = `${BLOCK_TYPE_PREFIX}sentence_container`;
const VERB_MOOD_TYPE = `${BLOCK_TYPE_PREFIX}verb_mood`;
const VERB_SUBJECT_TYPE = `${BLOCK_TYPE_PREFIX}verb_subject`;
const VERB_OBJECT_TYPE = `${BLOCK_TYPE_PREFIX}verb_object`;
const NOUN_ENDING_PICKER_TYPE = `${BLOCK_TYPE_PREFIX}noun_ending_picker`;
// Value-connection check type for the picker's object socket -- distinct
// from CONNECTION_TYPE (a previous/next STATEMENT connection every ordinary
// morpheme block uses) since this is a sideways value/output connection
// with no place in the linear stem-to-ending stack; a VERB_OBJECT_TYPE block
// can only ever plug into a picker's OBJECT_SLOT input, never the main chain.
const VERB_OBJECT_CONNECTION_TYPE = "VERB_OBJECT";
const VERB_MOOD_CONNECTION_TYPE = "VERB_MOOD";
const VERB_SUBJECT_CONNECTION_TYPE = "VERB_SUBJECT";
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
	{ key: "enclitic", id: "enclitic", name: "Enclitics", colourClass: "oq_enclitic", hasNext: false },
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
			// at the bottom (no sealing END dummy after WORDS).
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

function applyChainConnections(block, cat, { inline = true } = {}) {
	const startsWord = cat.hasPrevious === false;
	const hasNext = cat.hasNext !== false;
	if (!sideBySide()) {
		block.setPreviousStatement(true, startsWord ? WORD_START_CONNECTION_TYPE : CONNECTION_TYPE);
		block.setNextStatement(hasNext, CONNECTION_TYPE);
		return;
	}
	block.setOutput(true, startsWord ? WORD_START_CONNECTION_TYPE : CONNECTION_TYPE);
	if (hasNext) block.appendValueInput("NEXT").setCheck(CONNECTION_TYPE);
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

export function defineNounEndingPickerBlock(nounEndingIndex, presetsById, getDisplayOptions) {
	const options = (values, labels = values) => (values.length ? values.map((value, i) => [labels[i] ?? value, value]) : [["—", "NONE"]]);
	const resolveFor = (block, variantOverride) => {
		const candidates = nounCandidatesFor(nounEndingIndex, block.getFieldValue("CASE"), block.getFieldValue("POSSESSOR"), block.getFieldValue("NUMBER"));
		block.nounEndingPickerState.candidates = candidates.map((c) => [c.label.slice(0, 70), c.id]);
		// Field validators run before the new value is stored. A VARIANT
		// change has to pass that proposed id in, or this read of the field
		// still sees the previous candidate and writes it back to block.data.
		const currentVariant = variantOverride ?? block.getFieldValue("VARIANT");
		const id = candidates.some((c) => c.id === currentVariant) ? currentVariant : candidates[0]?.id ?? null;
		block.data = id;
		block.getField("RESOLVED")?.setValue(id && presetsById.get(id) ? labelFor(presetsById.get(id), getDisplayOptions()) : t("noSuchEnding"));
		if (block.rendered) block.render();
		return id;
	};
	Blockly.Blocks[NOUN_ENDING_PICKER_TYPE] = {
		init() {
			this.nounEndingPickerState = { candidates: [] };
			this.appendDummyInput("RESOLVED").appendField(new Blockly.FieldLabelSerializable(""), "RESOLVED");
			const changed = function (newValue) {
				const block = this.getSourceBlock();
				if (block) resolveFor(block, this.name === "VARIANT" ? newValue : undefined);
				return newValue;
			};
			this.appendDummyInput().appendField(`${UI_INDENT}Case`).appendField(new Blockly.FieldDropdown(options(nounEndingIndex.cases), changed), "CASE");
			this.appendDummyInput().appendField(`${UI_INDENT}Possessor`).appendField(new Blockly.FieldDropdown(options(nounEndingIndex.possessors), changed), "POSSESSOR");
			this.appendDummyInput().appendField(`${UI_INDENT}Number`).appendField(new Blockly.FieldDropdown(options(nounEndingIndex.numbers), changed), "NUMBER");
			this.appendDummyInput("VARIANT").appendField(`${UI_INDENT}Variant`).appendField(new Blockly.FieldDropdown(function () { return this.getSourceBlock()?.nounEndingPickerState?.candidates ?? [["—", "NONE"]]; }, changed), "VARIANT");
			this.setStyle(INFLECTION_BLOCK_STYLE);
			this.setInputsInline(false);
			this.nounEndingPickerState.resolve = () => resolveFor(this);
			applyChainConnections(this, { hasNext: true }, { inline: false });
			resolveFor(this);
		},
	};
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

function verbEndingPickerFields(verbEndingIndex, resolveMoodLabel, resolvePersonLabel) {
	const moodOptions = verbEndingIndex.moods.map((m) => [moodDisplayLabel(m, resolveMoodLabel), m]);
	const subjectOptions = verbEndingIndex.subjectCombos.map((c) => [personNumberLabel(c, resolvePersonLabel), c]);
	const polarityOptions = [["affirmative", "positive"], ["negative", "negative"]];
	const polarityMapping = Object.fromEntries(verbEndingIndex.moods.map((mood) => [
		mood,
		(verbEndingIndex.polaritiesByMood.get(mood) ?? ["positive"]).map((polarity) => [
			polarity === "negative" ? "negative" : "affirmative", polarity,
		]),
	]));
	return { moodOptions, subjectOptions, polarityOptions, polarityMapping };
}

function subjectCombosFor(block, verbEndingIndex) {
	const mood = block?.getFieldValue("MOOD");
	const transitivity = block?.getInputTargetBlock("OBJECT_SLOT") ? "transitive" : "intransitive";
	return verbEndingIndex.subjectCombosByMoodTransitivity.get(`${mood}|${transitivity}`)
		?? verbEndingIndex.subjectCombos;
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
function resolveVerbPicker(block, verbEndingIndex, presetsById, getDisplayOptions, variantOverride) {
	const moodBlock = block.getInputTargetBlock("MOOD_SLOT");
	const subjectBlock = block.getInputTargetBlock("SUBJECT_SLOT");
	const mood = block.getFieldValue("MOOD") ?? moodBlock?.getFieldValue("MOOD");
	let subjectValue = block.getFieldValue("SUBJECT") ?? subjectBlock?.getFieldValue("COMBO");
	const subjectField = block.getField("SUBJECT");
	const validSubjects = subjectCombosFor(block, verbEndingIndex);
	if (subjectField && validSubjects.length && !validSubjects.includes(subjectValue)) {
		subjectField.setValue(validSubjects[0]);
		subjectValue = validSubjects[0];
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

	const candidates = mood && subjectValue
		? candidatesFor(verbEndingIndex, mood, transitivity, sPerson, sNumber, oPerson, oNumber, polarity)
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
		const missing = !mood && !moodBlock ? "choose a mood" : !subjectValue ? "choose a subject" : t("noSuchEnding");
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
	const { moodOptions, subjectOptions, polarityOptions, polarityMapping } = verbEndingPickerFields(verbEndingIndex, resolveMoodLabel, resolvePersonLabel);

	function onVariantChange(newValue) {
		const block = this.getSourceBlock();
		if (block) resolveVerbPicker(block, verbEndingIndex, presetsById, getDisplayOptions, newValue);
		return newValue;
	}

	Blockly.Blocks[VERB_MOOD_TYPE] = {
		init() {
			this.appendDummyInput()
				.appendField(new Blockly.FieldDropdown(moodOptions), "MOOD");
			this.setOutput(true, VERB_MOOD_CONNECTION_TYPE);
			this.setStyle(INFLECTION_BLOCK_STYLE);
			this.setInputsInline(true);
			this.setTooltip("Verb mood");
		},
	};

	Blockly.Blocks[VERB_SUBJECT_TYPE] = {
		init() {
			this.appendDummyInput()
				.appendField(new Blockly.FieldDropdown(subjectOptions), "COMBO");
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
				.appendField(new Blockly.FieldDropdown(moodOptions), "MOOD");
			this.appendDummyInput("POLARITY_ROW")
				.appendField(`${UI_INDENT}Polarity`)
				.appendField(new FieldDependentDropdown("MOOD", polarityMapping, polarityOptions), "POLARITY");
			this.appendDummyInput("SUBJECT_ROW")
				.appendField(`${UI_INDENT}Person`)
				.appendField(new Blockly.FieldDropdown(function () {
					const source = this.getSourceBlock();
					return subjectCombosFor(source, verbEndingIndex)
						.map((combo) => [personNumberLabel(combo, resolvePersonLabel), combo]);
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
			resolveVerbPicker(this, verbEndingIndex, presetsById, getDisplayOptions);
		},
	};

	Blockly.Blocks[VERB_ENDING_PICKER_TYPE].__resolve = (block) =>
		resolveVerbPicker(block, verbEndingIndex, presetsById, getDisplayOptions);
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
	const objectOptions = verbEndingIndex.objectCombos.map((c) => [personNumberLabel(c, resolvePersonLabel), c]);
	Blockly.Blocks[VERB_OBJECT_TYPE] = {
		init() {
			this.appendDummyInput()
				.appendField(new Blockly.FieldDropdown(objectOptions), "COMBO");
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

export { VERB_ENDING_PICKER_TYPE, VERB_MOOD_TYPE, VERB_SUBJECT_TYPE, VERB_OBJECT_TYPE };

/** True when `preset` is a real verb-mood inflectional ending -- one of the
 * ~278 entries carrying a structured `inflection.subject` (paradigm
 * coordinates), as opposed to a case/possession ending or anything else.
 * Shared by buildToolbox() (which excludes these from the flat list) and
 * renderSentencePlan() (which needs to know to build a picker instance, not a
 * plain block, for one of these) so the two conditions can't drift apart. */
function isVerbEndingPreset(preset) {
	return preset.morpheme_type === "inflectional_ending" && Boolean(preset.seq?.[0]?.inflection?.subject);
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
function restoreVerbPickerFields(workspace, block, preset) {
	const inflection = preset.seq[0].inflection;
	block.setFieldValue(inflection.mood, "MOOD");
	block.setFieldValue(comboKey(inflection.subject.person, inflection.subject.number), "SUBJECT");
	block.setFieldValue(inflection.polarity ?? "positive", "POLARITY");
	if (inflection.object) {
		const objectBlock = workspace.newBlock(VERB_OBJECT_TYPE);
		objectBlock.initSvg();
		objectBlock.render();
		objectBlock.setFieldValue(comboKey(inflection.object.person, inflection.object.number), "COMBO");
		block.getInput("OBJECT_SLOT").connection.connect(objectBlock.outputConnection);
	}
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
				// picker immediately after it.
				if (hasStructuredNounEndings) blocks.splice(1, 0, { kind: "block", type: NOUN_ENDING_PICKER_TYPE });
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
 * flags, and owning blocks. chainFromTopBlock / wordsFromBlock /
 * topLevelSentences / labelContainers are views over this tree.
 *
 * @param {any} workspace
 * @returns {{ sentences: Array<{ block: any, words: Array<{ ids: string[], held: string|null, block: any }> }> }}
 */
export function canvasTree(workspace) {
	const sentences = [];
	for (const top of workspace.getTopBlocks(true)) {
		if (top.type === SENTENCE_CONTAINER_TYPE) {
			const words = [];
			let cur = top.getInputTargetBlock("WORDS");
			while (cur) {
				if (cur.type === WORD_CONTAINER_TYPE) {
					const held = cur.bloqHeld || null;
					const ids = held ? [] : idsInsideWord(cur);
					if (held || ids.length) words.push({ ids, held, block: cur });
				} else if (isMorphemeBlockType(cur.type)) {
					const ids = morphemeIdsFrom(cur);
					if (ids.length) words.push({ ids, held: null, block: cur });
					break;
				}
				cur = cur.getNextBlock();
			}
			if (words.length) sentences.push({ block: top, words });
			continue;
		}
		if (top.type === WORD_CONTAINER_TYPE) {
			const held = top.bloqHeld || null;
			const ids = held ? [] : idsInsideWord(top);
			if (held || ids.length) sentences.push({ block: null, words: [{ ids, held, block: top }] });
			continue;
		}
		if (isMorphemeBlockType(top.type)) {
			const ids = morphemeIdsFrom(top);
			if (ids.length) sentences.push({ block: null, words: [{ ids, held: null, block: top }] });
		}
	}
	return { sentences };
}

function morphemeIdsFrom(block) {
	const ids = [];
	let cur = block;
	while (cur) {
		if (isMorphemeBlockType(cur.type) && cur.data) ids.push(cur.data);
		// Horizontal pieces plug into NEXT. Stack pieces use getNextBlock.
		// A fake test block has only one of the two.
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

/** Walks a stack of morpheme blocks starting at `block`, returning morpheme ids top to bottom. */
export function chainFromTopBlock(block) {
	if (block?.type === SENTENCE_CONTAINER_TYPE) return chainFromTopBlock(block.getInputTargetBlock("WORDS"));
	if (block?.type === WORD_CONTAINER_TYPE) return idsInsideWord(block);
	return morphemeIdsFrom(block);
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
				container.moveBy(20, 20);
				return;
			}
			const sentence = workspace.newBlock(SENTENCE_CONTAINER_TYPE);
			sentence.initSvg();
			sentence.render();
			sentence.moveBy(20, 20);
			connectWords(workspace, sentence, chains, presetsById, displayOptions);
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
					: buildHeldWord(workspace, !prevWord ? withInitialCapital(word.surface || word.raw) : (word.surface || word.raw), word.heldLabel || "not drawn");
				if (ids.length) drawable.push(ids);
				if (prevWord) prevWord.nextConnection.connect(wordBlock.previousConnection);
				else sentence.getInput("WORDS").connection.connect(wordBlock.previousConnection);
				prevWord = wordBlock;
			}
			stampAssembly(sentence, drawable, item.assembly || "");
			if (item.assembly) sentence.setFieldValue(item.assembly, "TRANSLATION");
			sentence.render();
			const height = sentence.getHeightWidth?.().height ?? 80;
			y += Math.max(height, 72) + 28;
		}
	});
}

function buildHeldWord(workspace, surface, label) {
	const container = workspace.newBlock(WORD_CONTAINER_TYPE);
	container.bloqHeld = label || "not drawn";
	container.initSvg();
	container.render();
	container.setFieldValue(surface || "…", "TITLE");
	container.setFieldValue(container.bloqHeld, "TRANSLATION");
	container.setTooltip(container.bloqHeld);
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

function stampAssembly(block, words, assembly) {
	if (!block || !assembly) return;
	block.bloqAssembly = assembly;
	block.bloqAssemblyKey = (words ?? []).map((ids) => ids.slice());
}

function assemblyKeyMatches(block, words) {
	const key = block?.bloqAssemblyKey;
	if (!block?.bloqAssembly || !Array.isArray(key)) return false;
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
		if (!block) continue;
		if (sideBySide()) {
			const socket = prev ? prev.getInput("NEXT")?.connection : container.getInput("MORPHEMES")?.connection;
			if (socket && block.outputConnection) socket.connect(block.outputConnection);
		} else if (prev) {
			prev.nextConnection.connect(block.previousConnection);
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
	let firstOfWord = true;
	for (const id of ids) {
		const block = createMorphemeBlock(workspace, id, presetsById, displayOptions);
		if (!block) continue;
		const label = block.getFieldValue("LABEL") || block.getFieldValue("RESOLVED") || id;
		const est = Math.min(240, 56 + String(label).length * 7);
		if (!row || (prev && used + est > max)) {
			row = workspace.newBlock(ROW_TYPE);
			row.initSvg();
			row.render();
			row.getInput("CHAIN").setCheck(firstOfWord ? WORD_START_CONNECTION_TYPE : CONNECTION_TYPE);
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
		firstOfWord = false;
	}
}

function lastStatement(block) {
	let cur = block;
	while (cur?.getNextBlock()) cur = cur.getNextBlock();
	return cur;
}

function createMorphemeBlock(workspace, id, presetsById, displayOptions) {
	const preset = presetsById.get(id);
	if (!preset) return null;
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
			const assembled = assemblyKeyMatches(top, drawableIds) ? top.bloqAssembly : null;
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
 * (stem cannot follow, particle is alone, enclitic seals the chain); join
 * legality stays in buildWord().
 */
export function structuralCategoryConnections() {
	return CATEGORY_ORDER.map((cat) => ({
		id: cat.id,
		key: cat.key,
		wordClass: cat.wordClass ?? null,
		hasPrevious: cat.hasPrevious !== false,
		hasNext: cat.hasNext !== false,
		previousCheck: cat.hasPrevious === false ? WORD_START_CONNECTION_TYPE : CONNECTION_TYPE,
		nextCheck: cat.hasNext === false ? null : CONNECTION_TYPE,
	}));
}

export { buildVerbEndingIndex, buildNounEndingIndex, WORD_CONTAINER_TYPE, SENTENCE_CONTAINER_TYPE, NOUN_ENDING_PICKER_TYPE };
