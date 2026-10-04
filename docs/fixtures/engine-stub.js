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
