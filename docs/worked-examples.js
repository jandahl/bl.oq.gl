import { STANDARD_EXAMPLES, getStandardExamples } from "./oq-api.js";

// Standard examples are part of the pinned oq-api release. Keep the public
// constant available for consumers that need the immutable catalog, and use a
// defensive copy when the UI filters or enriches entries.
export { STANDARD_EXAMPLES, getStandardExamples };

/**
 * @returns {Promise<Array<{ surface: string, gloss?: string, chain?: string[] }>>}
 */
export async function loadWorkedExamples() {
	return getStandardExamples().worked;
}
