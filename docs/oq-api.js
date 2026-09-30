// Pin + load the experimental oq public API. The SOURCE repo is private, so
// the only live copies are published deployments. `public-api.md` is explicit
// that API_VERSION is 0.x — this pin is a tracked decision (see README).
//
// Pair this pin with the GRAMMAR_MORPHEMES_URL the module exports. Do not mix
// a rolling API with an independently rolling catalog.
//
// loadEngine() is the testable port: unit tests and fixture e2e inject a
// stub via globalThis.__BLOQ_ENGINE_URL__ (or pass a URL) instead of hitting
// the live host. Production keeps the default CDN URL.
export const OQ_API_URL = "https://jandahl.github.io/api.oq.gl/api/v0.3.55/public-api.js";

/**
 * @param {string} [url]
 * @returns {Promise<Record<string, any>>}
 */
export async function loadEngine(url = globalThis.__BLOQ_ENGINE_URL__ || OQ_API_URL) {
	return import(/* @vite-ignore */ url);
}

const api = await loadEngine();

// Re-export only symbols docs/ actually calls. Conjugation / have-N helpers
// stay on the pinned module for explorers who import it directly; BLOQ does
// not surface them as its own API.
export const {
	buildWord,
	analyzeWordAsync,
	tokenizeSentence,
	analyzeSentence,
	assembleClause,
	mergeMorphemeSources,
	glossSummaryItems,
	headlineGloss,
	GRAMMAR_MORPHEMES_URL,
	resolveMoodLabel,
	resolvePersonLabel,
	WORD_CLASS_THEMES,
	getWordClassColors,
	STANDARD_EXAMPLES,
	getStandardExamples,
	setActiveLocale,
	getActiveLocale,
} = api;
