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

export function getWordClassColors() {
	return {};
}

export const STANDARD_EXAMPLES = {
	worked: [
		{ surface: "qimmeq", gloss: "dog" },
		{ surface: "nerivoq", gloss: "he/she eats" },
	],
	sentences: [
		{ words: ["qimmeq", "nerivoq"], gloss: "the dog eats" },
	],
};

export function getStandardExamples() {
	return {
		worked: STANDARD_EXAMPLES.worked.map((item) => ({ ...item })),
		sentences: STANDARD_EXAMPLES.sentences.map((item) => ({ ...item, words: [...item.words] })),
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
