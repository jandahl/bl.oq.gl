// @ts-check
// Engine data in; presentation data out. Never repair a missing catalog ID.
/** @param {string[]} ids @param {Map<string, any>} presets @param {any} catalog @param {{buildWord: Function, presentSequence: Function}} engine @param {any} [engineOptions] */
export function wordPresentation(ids, presets, catalog, engine, engineOptions = {}) {
	const missing = ids.filter((id) => !presets.has(id));
	if (missing.length) return { ids, missing, seq: [], built: null, graph: null, error: `Missing morphemes: ${missing.join(", ")}` };
	const seq = ids.flatMap((id) => presets.get(id).seq);
	try {
		const built = engine.buildWord(seq);
		const graph = engine.presentSequence(seq, catalog, { ...(built.ok ? { word: built.word } : {}), engineOptions });
		return { ids, missing, seq, built, graph, error: built.ok ? "" : built.reason || "Invalid sequence" };
	} catch (error) {
		return { ids, missing, seq, built: null, graph: null, error: error instanceof Error ? error.message : String(error) };
	}
}

/** @param {string[]} ids @param {number} index @param {'insert'|'remove'|'left'|'right'} action @param {string} [id] */
export function editChain(ids, index, action, id = "") {
	const next = ids.slice();
	if (action === "insert" && id && index >= 0 && index <= next.length) next.splice(index, 0, id);
	if (action === "remove" && index >= 0 && index < next.length) next.splice(index, 1);
	const to = action === "left" ? index - 1 : action === "right" ? index + 1 : -1;
	if (to >= 0 && to < next.length && index >= 0 && index < next.length) [next[index], next[to]] = [next[to], next[index]];
	return next;
}
