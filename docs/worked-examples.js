import { getStandardExamples } from "./oq-api.js";

/**
 * Sole reader of the pinned STANDARD_EXAMPLES catalog. Returns a defensive
 * copy so UI filtering cannot mutate the release constant.
 * @returns {Promise<{ worked: Array<{ surface: string, gloss?: string, chain?: string[] }>, sentences: Array<{ words: string[], gloss?: string }> }>}
 */
export async function loadStandardExamples() {
	return getStandardExamples();
}

/**
 * @returns {Promise<Array<{ surface: string, gloss?: string, chain?: string[] }>>}
 */
export async function loadWorkedExamples() {
	const examples = await loadStandardExamples();
	return examples.worked;
}
