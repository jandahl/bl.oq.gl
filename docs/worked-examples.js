/**
 * Compatibility re-exports. Prefer `examples.js` (loader + Misiliineq-style
 * browse panel). Kept so older imports keep resolving.
 */
export {
	loadExamplesCatalog,
	loadStandardExamples,
	loadWorkedExamples,
	normalizeExamplesCatalog,
	adaptLegacyExamplesCatalog,
	mountExamplesPanel,
	glossForExample,
	glossText,
	examplesRemoteUrl,
	examplesVersionedUrl,
	EXAMPLES_CDN_URL,
	EXAMPLES_REMOTE_URL,
} from "./examples.js";
