// Re-exports oq's experimental public API. jandahl/oq's SOURCE repo is
// private, so a commit-pinned CDN URL (jsdelivr/raw.githubusercontent
// against the repo) is not reachable from a browser — the only live copies
// are oq's own published deployments, which public-api.md's own Quick Start
// already assumes as the consumption path. `public-api.md`'s stability
// posture is explicit ("API_VERSION is 0.x, any commit may rename, reshape,
// or drop any export"), so which deployment this points at is a live,
// tracked decision — see README.md for the current choice and why.
//
// Pin the engine in production. oq-api's exported GRAMMAR_MORPHEMES_URL is
// the compatibility boundary for the matching grammarian catalog; consumers
// must not pair a rolling API with an independently rolling legacy catalog.
// Resolved from oq-api's published api/latest.json (v0.3.30). Use the GitHub
// Pages mirror because api.oq.gl is protected by Cloudflare WAF from CI.
const OQ_API_URL = "https://jandahl.github.io/api.oq.gl/api/v0.3.30/public-api.js";

export const {
	buildWord,
	analyzeWord,
	analyzeWordAsync,
	morphemeEntryToPreset,
	mergeMorphemeSources,
	glossSummary,
	glossSummaryItems,
	headlineGloss,
	API_VERSION,
	GRAMMAR_MORPHEMES_URL,
	// Resolved conjugation labels (oq#881) — the same friendly text oq's own
	// "conjugate to..." modal shows for a mood/person paradigm coordinate,
	// so the verb ending picker doesn't have to re-derive its own wording
	// independently. See verb-endings.js.
	resolveMoodLabel,
	resolvePersonLabel,
	resolveFieldLabel,
	// One-call conjugation transform (oq-api 0.3.22+) plus catalog helpers.
	// Prefer conjugateForm when a consumer wants headword + mood/person(/object)
	// → surface without assembling derive*/findEnding/conjugate locally.
	// Options (spec): catalog, mood, subject|{person,number}, object?,
	// transitive?, stemHint? (intr + tr since 0.3.23), gloss?.
	// Returns { ok, word, approximate, stem, ending, schwa, errorKey, translation }.
	buildEndingCatalog,
	catalogMoods,
	endingsForMood,
	subjectsForMood,
	objectsForSubject,
	findEnding,
	deriveIntransitiveStem,
	deriveTransitiveStem,
	deriveSchwaStem,
	canConjugate,
	conjugate,
	conjugateSchwaStem,
	conjugateForm,
	// Have-N one-call transform (oq-api 0.3.30+): host N + optional count/howMany/many/truth +
	// Bjørnum K6§2 INS companions (numeralInstrumentalSurface; qty-6 = arfinillit);
	// intensifier + -qaq + conjugation ending via buildWord. Never invents stems.
	// Returns { ok, word, phrase, numeral, truth, seq, errorKey, missingIds, … }.
	haveNForm,
	HAVE_N_CARDINALS,
	HAVE_N_HOW_MANY,
	HAVE_N_MANY,
	HAVE_N_INTENSIFIERS,
	HAVE_N_TRUTH,
	HAVE_N_TRUTH_SURFACES,
	numeralInstrumentalSurface,
	glossSentence,
	t,
	setActiveLocale,
	getActiveLocale,
	WORD_CLASS_THEMES,
	getWordClassColors,
	STANDARD_EXAMPLES,
	getStandardExamples,
} = await import(/* @vite-ignore */ OQ_API_URL);
