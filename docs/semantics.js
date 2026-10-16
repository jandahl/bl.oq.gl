// Pure semantic composition and frame presentation helpers for BLOQ.
// Consumes oq-api's sequence-semantic-composition and semantic-frame-presentation.

export const SEQUENCE_COMPOSITION_SCHEMA = "sequence-composition/v1";
export const SEMANTIC_FRAME_SCHEMA = "semantic-frame/v1";
export const SEMANTIC_SOURCE_CONTRACT = "semantic-source/v2";

/**
 * Forward semantic composition over a sequence of morpheme IDs.
 *
 * @param {string[]} ids
 * @param {Map<string, any>} presetsById
 * @param {object} [options]
 * @param {object} [engine]
 * @returns {object}
 */
export function composeChainSemantics(ids, presetsById, options = {}, engine = {}) {
	const items = (ids || []).map((id) => presetsById?.get?.(id)).filter(Boolean);
	const seq = items.flatMap((item) => (Array.isArray(item.seq) ? item.seq : [item]));
	if (typeof engine.composeSequenceSemantics === "function") {
		return engine.composeSequenceSemantics(seq, presetsById, options);
	}
	return {
		schema_version: SEQUENCE_COMPOSITION_SCHEMA,
		ok: seq.length > 0,
		obligations: [],
		root: ids?.[0] ?? null,
	};
}

/**
 * Attach semantic frame data to presented word matches or sentence readings.
 *
 * @param {object} result
 * @param {any} catalog
 * @param {object} [engine]
 * @returns {object}
 */
export function attachFrames(result, catalog, engine = {}) {
	if (typeof engine.attachSemanticFrames === "function") {
		return engine.attachSemanticFrames(result, catalog);
	}
	if (!result) return result;
	return {
		...result,
		semantic_frame: { schema_version: SEMANTIC_FRAME_SCHEMA },
	};
}
