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
//
// After oq-api#337 publishes standard-examples/v1, prefer bumping this pin so
// getStandardExamples / glossText ship from the package; until then examples.js
// falls back to the rolling/versioned JSON URLs documented there.
export const OQ_API_URL = "https://jandahl.github.io/api.oq.gl/api/v0.3.61/public-api.js";

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
// glossText / STANDARD_EXAMPLES_SCHEMA land with standard-examples/v1 (#337);
// older pins leave them undefined and examples.js uses local helpers + CDN.
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
	glossText,
	STANDARD_EXAMPLES_SCHEMA,
	STANDARD_EXAMPLES_ID,
} = api;
