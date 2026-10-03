// Encodes/decodes bl-oq-ly's shareable state -- route, Deconstruct's word,
// Build's block chain -- to and from the URL, so a learner
// can copy the address bar and hand someone else the exact same view:
// "look at this word", "look at how I built this".
//
// The URL is a single-page state: `w` identifies a Deconstruct word and
// `chain` identifies a Build canvas. The active mode owns its parameter, so
// an automatic Deconstruct result does not leak its morpheme IDs into the
// copied link.
//
// `view` restores the selected visualization; Blockly is the omitted default.
//
// `chain` is one sentence of words (morpheme ids comma-joined, words
// semicolon-joined). Several sentences on the canvas use `|` between those
// groups: `qimmeq;nerivoq|illu`. Deconstruct of running text still shares
// the source as `w` and rebuilds the lattice on load.
//
// Deliberately NOT included: theme, language, spelling mode, show-ids,
// reading order (app.js's own localStorage-backed *_KEY constants). Those
// are "how I like to see things," not "what I'm looking at" -- baking a
// sharer's own display preferences into a link would silently override
// whatever the recipient already has set, for no reason connected to the
// content being shared. Filter text and palette visibility are left out for
// the same reason: transient UI state, not content.
//
// Pure functions only (no DOM/history access) so this module stays plain
// Node-testable, same discipline as gloss.js/verb-endings.js -- app.js owns
// the actual history.pushState/replaceState calls and the popstate listener.

const VISUALIZATION_VIEWS = ["blockly", "cards", "interlinear", "tree", "ports", "stepper"];
export function normalizeView(view) {
	return VISUALIZATION_VIEWS.includes(view) ? view : "blockly";
}

/**
 * Reads {mode, word, chain, words, sentences, view} out of a URLSearchParams-
 * compatible search string (e.g. `location.search`). Anything missing or
 * invalid falls back to a safe default rather than throwing -- a
 * hand-edited or stale link should degrade gracefully, not break the app
 * on load.
 * `chain` is the first word of the first sentence (legacy single stack).
 * `words` is the first sentence. `sentences` is every sentence.
 * @param {string} search
 * @returns {{ mode: "build"|"deconstruct", word: string, chain: string[], words: string[][], sentences: string[][][], view: string }}
 */
function parseWords(chainRaw) {
	if (!chainRaw) return [];
	if (chainRaw.includes(";")) {
		return chainRaw.split(";").map((part) => part.split(",").map((s) => s.trim()).filter(Boolean)).filter((w) => w.length);
	}
	const chain = chainRaw.split(",").map((s) => s.trim()).filter(Boolean);
	return chain.length ? [chain] : [];
}

function parseSentences(chainRaw) {
	if (!chainRaw) return [];
	return chainRaw.split("|").map((group) => parseWords(group)).filter((words) => words.length);
}

export function readState(search) {
	const params = new URLSearchParams(search);
	const mode = params.get("mode");
	const chainRaw = params.get("chain");
	// Accept the old query-based format so existing links remain usable.
	const word = params.get("w") ?? params.get("word") ?? "";
	const sentences = parseSentences(chainRaw);
	const words = sentences[0] ?? [];
	return {
		view: normalizeView(params.get("view")),
		mode: mode === "deconstruct" || params.has("w") ? "deconstruct" : "build",
		word,
		chain: words[0] ?? [],
		words,
		sentences,
	};
}

/**
 * Builds the query string (leading "?", or "" for entirely-default/empty
 * state) for {mode, word, chain, words, sentences, view}. Omits a param at its
 * default/empty value so an untouched app still links to a bare path.
 * The active mode owns its state: Deconstruct uses the short `w` key,
 * while Build uses `chain`; inactive-mode state is never emitted.
 * @param {{ mode?: string, word?: string, chain?: string[], words?: string[][], sentences?: string[][][], view?: string }} [state]
 * @returns {string}
 */
export function writeState({ mode, word, chain, words, sentences, view } = {}) {
	const params = new URLSearchParams();
	if (mode === "deconstruct") {
		if (word) params.set("w", word);
	} else {
		const sentenceList = (sentences && sentences.length)
			? sentences
			: ((words && words.length) ? [words] : (chain && chain.length ? [[chain]] : []));
		const encoded = sentenceList
			.map((sentence) => sentence.map((ids) => ids.join(",")).join(";"))
			.filter(Boolean);
		if (encoded.length) params.set("chain", encoded.join("|"));
	}
	if (normalizeView(view) !== "blockly") params.set("view", view);
	const qs = params.toString();
	return qs ? `?${qs}` : "";
}

/** Returns the canonical route, preserving a deployed site's base path. */
export function routeForState(pathname = "/") {
	const stripped = String(pathname || "/").replace(/\/deconstruct\/?$/, "") || "/";
	if (stripped.endsWith("/")) return stripped;
	// Only a final segment with one extension (index.html) is a file.
	// A dotted base such as /bl.oq.gl is still a directory.
	const last = stripped.slice(stripped.lastIndexOf("/") + 1);
	if (/^[^./]+\.[a-z0-9]+$/i.test(last)) return stripped;
	return `${stripped}/`;
}
