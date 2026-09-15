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

/**
 * Reads {mode, word, chain} out of a URLSearchParams-compatible search
 * string (e.g. `location.search`). Anything missing or invalid falls back
 * to a safe default (`mode: "build"`, `word: ""`, `chain: []`) rather than
 * throwing -- a hand-edited or stale link should degrade gracefully, not
 * break the app on load.
 * @param {string} search
 * @returns {{ mode: "build"|"deconstruct", word: string, chain: string[] }}
 */
function parseWords(chainRaw) {
	if (!chainRaw) return [];
	if (chainRaw.includes(";")) {
		return chainRaw.split(";").map((part) => part.split(",").map((s) => s.trim()).filter(Boolean)).filter((w) => w.length);
	}
	const chain = chainRaw.split(",").map((s) => s.trim()).filter(Boolean);
	return chain.length ? [chain] : [];
}

export function readState(search) {
	const params = new URLSearchParams(search);
	const mode = params.get("mode");
	const chainRaw = params.get("chain");
	// Accept the old query-based format so existing links remain usable.
	const word = params.get("w") ?? params.get("word") ?? "";
	const words = parseWords(chainRaw);
	return {
		mode: mode === "deconstruct" || params.has("w") ? "deconstruct" : "build",
		word,
		chain: words[0] ?? [],
		words,
	};
}

/**
 * Builds the query string (leading "?", or "" for entirely-default/empty
 * state) for {mode, word, chain}. Omits a param at its default/empty value
 * so an untouched app still links to a bare path, not a query string full
 * of defaults. The active mode owns its state: Deconstruct uses the short
 * `w` key, while Build uses `chain`; inactive-mode state is never emitted.
 * @param {{ mode?: string, word?: string, chain?: string[] }} state
 * @returns {string}
 */
export function writeState({ mode, word, chain, words } = {}) {
	const params = new URLSearchParams();
	if (mode === "deconstruct") {
		if (word) params.set("w", word);
	} else {
		const list = (words && words.length) ? words : (chain && chain.length ? [chain] : []);
		if (list.length === 1) params.set("chain", list[0].join(","));
		else if (list.length > 1) params.set("chain", list.map((w) => w.join(",")).join(";"));
	}
	const qs = params.toString();
	return qs ? `?${qs}` : "";
}

/** Returns the canonical route, preserving a deployed site's base path. */
export function routeForState(pathname = "/") {
	const suffix = "/deconstruct/";
	const base = pathname.endsWith(suffix)
		? pathname.slice(0, -suffix.length)
		: pathname.endsWith("/") ? pathname : `${pathname}/`;
	return base || "/";
}
