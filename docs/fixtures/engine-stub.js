// Minimal oq-api surface for fixture e2e / offline boots. Not a morphology
// engine — Build concatenates citation forms; Deconstruct returns no matches.

const FIXTURE_CATALOG_URL = "./fixtures/catalog-mini.json";

function entryToPreset(id, entry) {
	const form = entry.application_logic?.underlying_form ?? id;
	const facts = entry.lexical_facts ?? {};
	const plain = entry.plain_gloss ?? {};
	const inflection = entry.inflection ?? facts.inflection;
	return {
		id,
		expected: form,
		underlyingForm: form,
		morpheme_type: facts.morpheme_type,
		word_class: facts.word_class || "",
		glossShort: facts.meaning || plain.en_short || "",
		gloss: facts.meaning || plain.en || "",
		plainGloss: {
			en_short: plain.en_short ?? plain.en,
			da_short: plain.da_short ?? plain.da,
			en: plain.en,
			da: plain.da,
			en_mood_label: plain.en_mood_label,
			da_mood_label: plain.da_mood_label,
		},
		seq: [{
			id,
			text: form,
			...(inflection ? { inflection } : {}),
			...(facts.category_shift ? { category_shift: facts.category_shift } : {}),
		}],
		lexical_facts: {
			...facts,
			...(entry.lexical_facts_case ? { case: entry.lexical_facts_case } : {}),
			case: facts.case || entry.case,
		},
		searchForms: [form, id].filter(Boolean),
	};
}

export function mergeMorphemeSources(results) {
	const value = results?.[0]?.value;
	if (!value) return { presets: [], anyOk: false, failed: ["empty"] };
	if (Array.isArray(value.presets)) {
		return { presets: value.presets, anyOk: value.presets.length > 0, failed: [] };
	}
	const presets = [];
	for (const [id, entries] of Object.entries(value.by_id || {})) {
		const entry = Array.isArray(entries) ? entries[0] : entries;
		if (entry) presets.push(entryToPreset(id, entry));
	}
	return { presets, anyOk: presets.length > 0, failed: [] };
}

export const GRAMMAR_MORPHEMES_URL = FIXTURE_CATALOG_URL;
export const DICT_SOURCES = [{ name: "Fixture dictionary", urls: [] }];

export async function searchEntries(_sources, query) {
	const normalized = String(query || "").trim().toLowerCase();
	const result = normalized.includes("arna") ? [{
		surface: "arnaq",
		wordClass: { en: "noun", path: ["noun"] },
		gloss_en: "woman, female",
		gloss_da: "kvinde, kvindelig",
		glosses: { en: "woman, female", da: "kvinde, kvindelig" },
		gloss_options: { en: ["woman", "female"], da: ["kvinde", "kvindelig"] },
	}] : [];
	return { results: result, attributions: ["fixture"], failed: false, errors: [] };
}

// Fixture-only contract adapter: labels are IDs and surfaces concatenate.
// It intentionally makes no linguistic correctness claims.
export function presentSequence(seq, _catalog, options = {}) {
	let start = 0;
	const nodes = [];
	const edges = [];
	seq.forEach((item, seqIndex) => {
		const text = String(item.text || "").replace(/^-/, "");
		const surface = options.word === undefined ? null : { j: seqIndex, citationText: text, marker: "", surfaceStart: start, surfaceEnd: start + text.length, surfaceText: text, changedRanges: [] };
		start += text.length;
		const label = { gloss: item.id, stemIn: "", stemOut: item.id, semanticStep: { safe: false }, inflection: item.inflection };
		if (globalThis.__BLOQ_TEST_GLOSS_TEMPLATES__) label.templateGloss = `${item.id} template`;
		nodes.push({ id: `m-${seqIndex}`, kind: "morpheme", seqIndex, morpheme_id: item.id, zero_surface: text === "", surface, labels: { en: label, da: label } });
		if (seqIndex > 0) {
			nodes.push({ id: `d-${seqIndex}`, kind: "ordered_derivation", seqIndex, labels: { en: label, da: label } });
			edges.push({ parent: `d-${seqIndex}`, operand: seqIndex === 1 ? "m-0" : `d-${seqIndex - 1}`, relation: "host" }, { parent: `d-${seqIndex}`, operand: `m-${seqIndex}`, relation: "affix" });
		}
	});
	return { schema_version: "sequence-presentation/v1", nodes, derivation: { root: seq.length > 1 ? `d-${seq.length - 1}` : seq.length ? "m-0" : null, status: "ordered_only", edges }, semantics: { status: "unresolved", verified: false, edges: [] }, obligations: [] };
}

export function buildWord(seq) {
	if (!Array.isArray(seq) || !seq.length) {
		return { ok: false, reason: "empty sequence", errorAt: -1, word: "", closed: false, approximate: false };
	}
	const bad = seq.findIndex((item) => !item || item.id === "BAD");
	if (bad >= 0) {
		return { ok: false, reason: "invalid sequence", errorAt: bad, word: "", closed: false, approximate: false };
	}
	const word = seq.map((item) => String(item.text ?? item.id ?? "").replace(/^-/, "")).join("");
	return { ok: true, word, closed: true, approximate: false };
}

export async function analyzeWordAsync() {
	const slow = Number(globalThis.__BLOQ_SLOW_ANALYZE__) || 0;
	if (slow > 0) {
		// Resolve even if the caller aborted. The Clear-canvas regression is a
		// response that lands after cancel; rejecting here would hide a missing
		// deconstructRun bump.
		await new Promise((resolve) => {
			globalThis.setTimeout(resolve, slow);
		});
		return {
			matches: [{
				seq: [
					{ id: "neri", text: "neri" },
					{ id: "V_IND_INTR_3SG", text: "voq" },
				],
			}],
			evalCount: 1,
		};
	}
	return { matches: [], evalCount: 0 };
}

export function tokenizeSentence(surface) {
	return String(surface || "").trim().split(/\s+/).filter(Boolean).map((s) => ({ surface: s }));
}

export function analyzeSentence() {
	return { sentences: [] };
}

export function assembleClause() {
	return { text: "", mode: "serial" };
}

export function glossSummaryItems(seq) {
	return (seq || []).map((item) => ({
		id: item.id,
		spelling: item.text || item.id,
		gloss: item.id,
	}));
}

export function headlineGloss(items) {
	return (items || []).map((item) => item.gloss).filter(Boolean).join(" · ");
}

export function resolveMoodLabel(mood) {
	return String(mood || "");
}

export function resolvePersonLabel(person) {
	return String(person || "");
}

export const WORD_CLASS_THEMES = {
	light: {},
	default: {},
};

export function getWordClassColors(path, theme = WORD_CLASS_THEMES.light) {
	const key = path?.[0] || "neutral";
	const hue = ({ nominal_root: 205, verbal_root: 145, derivational_affix: 35, inflectional_affix: 275, enclitic: 320 })[key] ?? 0;
	const dark = theme === WORD_CLASS_THEMES.default;
	return {
	// Blockly's fixture theme parser accepts compact hsl() values without spaces.
		fill: `hsl(${hue},60%,${dark ? 24 : 92}%)`,
		border: `hsl(${hue},55%,${dark ? 55 : 42}%)`,
		text: `hsl(${hue},35%,${dark ? 94 : 16}%)`,
	};
}

/** Tiny fixture catalog — not a parallel product list. Mirrors standard-examples/v1 shape. */
export const STANDARD_EXAMPLES_SCHEMA = "standard-examples/v1";
export const STANDARD_EXAMPLES_ID = "oq-api/standard-examples-fixture";

export const STANDARD_EXAMPLES = {
	schema_version: STANDARD_EXAMPLES_SCHEMA,
	id: STANDARD_EXAMPLES_ID,
	worked: [
		{ id: "nerivoq", surface: "nerivoq", gloss: "he/she eats", chain: ["neri", "V_IND_INTR_3SG"], tags: ["featured"] },
		{ id: "ajorpoq", surface: "ajorpoq", gloss: { en: "it is bad", da: "det er dårligt" }, chain: ["ajoq", "V_IND_INTR_3SG"], tags: ["featured"] },
	],
	sentences: [],
};

export function glossLocales(gloss) {
	if (gloss && typeof gloss === "object") {
		return {
			en: typeof gloss.en === "string" ? gloss.en : "",
			da: typeof gloss.da === "string" ? gloss.da : "",
			kl: typeof gloss.kl === "string" ? gloss.kl : "",
		};
	}
	const text = typeof gloss === "string" ? gloss : "";
	return { en: text, da: "", kl: "" };
}

export function glossText(gloss, locale = "en") {
	const parts = glossLocales(gloss);
	if (locale === "da") return parts.da || parts.en || parts.kl;
	if (locale === "kl") return parts.kl || parts.en || parts.da;
	return parts.en || parts.da || parts.kl;
}

export function getStandardExamples() {
	return {
		schema_version: STANDARD_EXAMPLES.schema_version,
		id: STANDARD_EXAMPLES.id,
		worked: STANDARD_EXAMPLES.worked.map((item) => ({ ...item, chain: item.chain ? [...item.chain] : undefined, tags: item.tags ? [...item.tags] : [] })),
		sentences: STANDARD_EXAMPLES.sentences.map((item) => ({ ...item, words: [...(item.words || [])] })),
	};
}

let activeLocale = "en";
export function setActiveLocale(locale) {
	activeLocale = locale === "da" ? "da" : "en";
	return activeLocale;
}
export function getActiveLocale() {
	return activeLocale;
}

export const NOUN_PARADIGM_CELLS = [
	{ id: "N_ABS_SG", case: "absolutive", number: "sg" },
	{ id: "N_ABS_PL", case: "absolutive", number: "pl" },
	{ id: "N_ERG_SG", case: "ergative", number: "sg" },
	{ id: "N_ERG_PL", case: "ergative", number: "pl" },
	{ id: "N_INS_SG", case: "instrumental", number: "sg" },
	{ id: "N_INS_PL", case: "instrumental", number: "pl" },
	{ id: "N_ALL_SG", case: "allative", number: "sg" },
	{ id: "N_ALL_PL", case: "allative", number: "pl" },
	{ id: "N_LOC_SG", case: "locative", number: "sg" },
	{ id: "N_ABL_SG", case: "ablative", number: "sg" },
	{ id: "N_VIA_SG", case: "vialis", number: "sg" },
	{ id: "N_EQU_SG", case: "equalis", number: "sg" },
	{ id: "N_EQU_PL", case: "equalis", number: "pl" },
];

export function matchNounStem(headword, stems) {
	const stem = (Array.isArray(stems) ? stems : []).find((s) => s?.id === headword || s?.text === headword);
	return stem ? { ok: true, stem, match: "exact" } : { ok: false, errorKey: "missing_stem", candidateIds: [] };
}

export function nounForm(stem, spec = {}) {
	const cellId = typeof spec.cell === "string" ? spec.cell : spec.cell?.id;
	const cell = NOUN_PARADIGM_CELLS.find((c) => c.id === cellId) || spec.cell || null;
	if (!stem || stem.word_class !== "N") {
		return { ok: false, status: "unavailable", word: null, approximate: false, closed: false, cell, stemId: stem?.id ?? null, errorKey: "invalid_selection" };
	}
	const text = stem.expected || stem.text || stem.id;
	const endingId = cell?.id || spec.ending?.id || "";
	return { ok: true, status: "built", word: `${text}_${endingId}`, approximate: false, closed: true, cell, stemId: stem.id, errorKey: null };
}

export function nounParadigm(stem, spec = {}) {
	return {
		stemId: stem?.id ?? null,
		cells: NOUN_PARADIGM_CELLS.map((cell) => nounForm(stem, { ...spec, cell: cell.id })),
	};
}

// ---------------------------------------------------------------------------
// Generation and card projection stubs (3a)
// ---------------------------------------------------------------------------
export const GENERATION_CARD_SCHEMA = "generation-card/v1";
export const GENERATION_CARD_FEATURE = "generation-sentence-cards";
export const GENERATION_CARD_FINISHED_SCHEMA = "generation-card-finished/v1";
export const GENERATION_CARD_PROJECTION_RECORDED = "recorded_chain";
export const GENERATION_CARD_PROJECTION_LIVE = "live_generation";
export const GENERATION_CARD_PROJECTION_UNKNOWN = "unknown";

export function inferGenerationCardProjectionKind(card) {
	if (card?.projection_kind === GENERATION_CARD_PROJECTION_RECORDED) return GENERATION_CARD_PROJECTION_RECORDED;
	if (card?.projection_kind === GENERATION_CARD_PROJECTION_LIVE) return GENERATION_CARD_PROJECTION_LIVE;
	return GENERATION_CARD_PROJECTION_UNKNOWN;
}

export function generationCardFinishedState(card) {
	if (!card || typeof card !== "object") {
		return {
			schema_version: GENERATION_CARD_FINISHED_SCHEMA,
			showable: false,
			complete: false,
			status_label: "Malformed generation card",
		};
	}
	const isRecorded = card.projection_kind === GENERATION_CARD_PROJECTION_RECORDED;
	return {
		schema_version: GENERATION_CARD_FINISHED_SCHEMA,
		showable: Boolean(card.ok),
		complete: Boolean(card.ok && !isRecorded),
		status_label: card.ok ? "Ready" : "Incomplete",
	};
}

export function projectGenerationCard(result, options = {}) {
	const words = Array.isArray(result?.words) ? result.words : [];
	return {
		schema_version: GENERATION_CARD_SCHEMA,
		ok: Boolean(result?.ok ?? true),
		projection_kind: GENERATION_CARD_PROJECTION_LIVE,
		words: words.map((w) => ({
			surface: w.surface || w.text || "",
			morpheme_ids: w.morpheme_ids || w.canvasIds || [],
		})),
		options,
	};
}

export function projectGenerationWordCard(args) {
	return {
		surface: args.surface || "",
		morpheme_ids: args.morpheme_ids || [],
	};
}

export function projectRecordedChainCard(args) {
	return {
		schema_version: GENERATION_CARD_SCHEMA,
		ok: true,
		projection_kind: GENERATION_CARD_PROJECTION_RECORDED,
		words: [{ surface: args.surface || "", morpheme_ids: args.morpheme_ids || [] }],
	};
}

export async function generateFromMeaning(args) {
	return {
		schema_version: "generation-result/v1",
		ok: true,
		words: [{ surface: "stub", morpheme_ids: ["neri", "V_IND_INTR_3SG"] }],
		args,
	};
}

export async function generateFromSource(args) {
	return {
		schema_version: "generation-result/v1",
		ok: true,
		words: [{ surface: "stub", morpheme_ids: ["neri", "V_IND_INTR_3SG"] }],
		args,
	};
}

// ---------------------------------------------------------------------------
// Translation contracts and sequence composition stubs (3b)
// ---------------------------------------------------------------------------
export const TRANSLATION_CONTRACT_VERSION = 1;
export const SOURCE_ANALYSIS_SCHEMA = "source-analysis/v1";
export const MEANING_GRAPH_SCHEMA = "meaning-graph/v1";
export const TARGET_PLAN_SCHEMA = "target-plan/v1";
export const GENERATION_CANDIDATE_SCHEMA = "generation-candidate/v1";

export function validateSourceAnalysis(doc) {
	const ok = Boolean(doc && doc.schema_version === SOURCE_ANALYSIS_SCHEMA);
	return { ok, errors: ok ? [] : [{ path: "schema_version", message: "invalid" }] };
}

export function validateMeaningGraph(doc) {
	const ok = Boolean(doc && doc.schema_version === MEANING_GRAPH_SCHEMA);
	return { ok, errors: ok ? [] : [{ path: "schema_version", message: "invalid" }] };
}

export function validateTargetPlan(doc, _context) {
	const ok = Boolean(doc && doc.schema_version === TARGET_PLAN_SCHEMA);
	return { ok, errors: ok ? [] : [{ path: "schema_version", message: "invalid" }] };
}

export function validateGenerationCandidate(doc, _context) {
	const ok = Boolean(doc && doc.schema_version === GENERATION_CANDIDATE_SCHEMA);
	return { ok, errors: ok ? [] : [{ path: "schema_version", message: "invalid" }] };
}

export const SEQUENCE_COMPOSITION_SCHEMA = "sequence-composition/v1";
export const SEMANTIC_SOURCE_CONTRACT = "semantic-source/v2";

export function composeSequenceSemantics(seq, _catalog, _options = {}) {
	const list = Array.isArray(seq) ? seq : [];
	return {
		schema_version: SEQUENCE_COMPOSITION_SCHEMA,
		ok: true,
		obligations: [],
		root: list[0]?.id ?? null,
	};
}

export function resolveCatalogVariant(ref, _catalog) {
	return typeof ref === "string" ? { id: ref } : ref;
}

export function normalizeSequenceSelection(item, _index) {
	return typeof item === "string" ? { id: item } : item;
}

export const SEMANTIC_FRAME_SCHEMA = "semantic-frame/v1";

export function attachSemanticFrames(result, _catalog) {
	return result ? { ...result, semantic_frame: { schema_version: SEMANTIC_FRAME_SCHEMA } } : result;
}

export function semanticFrameFromSequence(seq, _catalog) {
	return { schema_version: SEMANTIC_FRAME_SCHEMA, root: seq?.[0]?.id ?? null };
}

export function semanticFrameOrLegacy(seq, catalog) {
	return semanticFrameFromSequence(seq, catalog);
}
