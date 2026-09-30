/**
 * Compatibility re-exports. Prefer `examples.js` (loader + Misiliineq-style
 * browse panel). Kept so older imports keep resolving.
 */
export {
	loadExamplesCatalog,
	loadStandardExamples,
	loadWorkedExamples,
	normalizeExamplesCatalog,
	mountExamplesPanel,
	glossForExample,
	examplesRemoteUrl,
	EXAMPLES_REMOTE_URL,
} from "./examples.js";
