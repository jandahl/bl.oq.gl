// @ts-check
// Engine data in; presentation data out. Never repair a missing catalog ID.
/** @param {string[]} ids @param {Map<string, any>} presets @param {any} catalog @param {{buildWord: Function, presentSequence: Function, glossSummaryItems?: Function}} engine @param {any} [engineOptions] */
export function wordPresentation(ids, presets, catalog, engine, engineOptions = {}) {
	const missing = ids.filter((id) => !presets.has(id));
	if (missing.length) return { ids, missing, seq: [], built: null, graph: null, error: `Missing morphemes: ${missing.join(", ")}` };
	const seq = ids.flatMap((id) => presets.get(id).seq);
	try {
		const built = engine.buildWord(seq);
		const graph = engine.presentSequence(seq, catalog, { ...(built.ok ? { word: built.word } : {}), engineOptions });
		// Templates and accumulated meanings both come from the pinned engine.
		// Keep both: switching presentation must never alter Build evidence.
		if (engine.glossSummaryItems) for (const lang of ["en", "da"]) {
			const rows = engine.glossSummaryItems(seq, { ...engineOptions, lang, includeGlossless: true });
			for (const node of graph.nodes) {
				const row = rows.find((/** @type {any} */ row) => row.seqIndex === node.seqIndex);
				if (node.labels?.[lang] && row) node.labels[lang].templateGloss = row.rawShortGloss ?? row.shortGloss ?? row.gloss;
			}
		}
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

/** Empty editor slots are not held analyses. Preserve genuine held words
 * and pre-existing empty sentence containers.
 * @param {{words?: {heldLabel?: string, canvasIds?: string[]}[], [key: string]: any}[]} plan */
export function normalizeEditablePlan(plan) {
	return plan.map((sentence) => ({ ...sentence, words: (sentence.words || []).filter((word) => word.heldLabel || word.canvasIds?.length) }))
		.filter((sentence, index) => sentence.words.length || !plan[index].words?.length);
}

/** A chain edit invalidates assembly evidence for its sentence, not siblings.
 * @param {any[]} plan @param {number} s @param {number} w @param {number} index
 * @param {'insert'|'remove'|'left'|'right'} operation @param {string} [id] */
export function editPlanChain(plan, s, w, index, operation, id) {
	const next = plan.slice();
	const sentence = plan[s], word = sentence?.words?.[w];
	if (!word || word.heldLabel) return next;
	const ids = editChain(word.canvasIds || [], index, operation, id);
	const words = sentence.words.slice(); words[w] = { ...word, canvasIds: ids };
	next[s] = { ...sentence, words };
	if (JSON.stringify(ids) !== JSON.stringify(word.canvasIds || [])) delete next[s].assembly;
	return next;
}
