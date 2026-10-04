// @ts-check
/**
 * Interleave only the engine's realized morpheme spans with the remaining
 * literal text of the engine-built word. Gaps stay visible and are never
 * assigned to an inferred morpheme.
 * @param {string} surface
 * @param {any[]} nodes
 * @returns {{segments: any[], aligned: boolean}}
 */
export function surfaceRibbonSegments(surface, nodes) {
	if (typeof surface !== "string" || !Array.isArray(nodes) || !nodes.length) return { segments: [], aligned: false };
	const segments = [];
	// resolveMorphemeSurfaces omits zero-length rows. A zero-surface node can
	// still be placed when its position in the API sequence is bounded by
	// adjacent engine spans (or the beginning/end of the word).
	const spans = nodes.map((node) => node?.surface || null);
	for (let index = 0; index < nodes.length; index++) {
		if (spans[index] || !nodes[index]?.zero_surface) continue;
		const previous = spans.slice(0, index).reverse().find(Boolean);
		const next = spans.slice(index + 1).find(Boolean);
		const start = previous?.surfaceEnd ?? 0;
		const end = next?.surfaceStart ?? surface.length;
		if (start !== end) return { segments: [], aligned: false };
		spans[index] = { surfaceStart: start, surfaceEnd: end, surfaceText: "" };
	}
	let cursor = 0;
	for (const [index, node] of nodes.entries()) {
		const span = spans[index];
		const start = span?.surfaceStart, end = span?.surfaceEnd;
		if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < cursor || end < start || end > surface.length) {
			return { segments: [], aligned: false };
		}
		if (start > cursor) segments.push({ kind: "unmapped", text: surface.slice(cursor, start), start: cursor, end: start });
		const text = surface.slice(start, end);
		if (typeof span.surfaceText !== "string" || text !== span.surfaceText || (node.zero_surface && text !== "")) {
			return { segments: [], aligned: false };
		}
		segments.push({ kind: "morpheme", text, node, start, end });
		cursor = end;
	}
	if (cursor < surface.length) segments.push({ kind: "unmapped", text: surface.slice(cursor), start: cursor, end: surface.length });
	return { segments, aligned: true };
}
