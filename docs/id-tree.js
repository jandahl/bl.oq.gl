// Pure id-tree helpers. No Blockly, no DOM, no catalog — session.js can
// compare Build plans without importing the UI module.

/** Id-only view of a canvas tree (share URL / plan compare shape). */
export function canvasIdTree(tree) {
	return (tree?.sentences ?? []).map((sentence) =>
		sentence.words.filter((word) => !word.held).map((word) => word.ids));
}

/** Deep equality for string[][][] id trees — no JSON.stringify. */
export function sameIdTree(a, b) {
	if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
	for (let s = 0; s < a.length; s++) {
		const wa = a[s];
		const wb = b[s];
		if (!Array.isArray(wa) || !Array.isArray(wb) || wa.length !== wb.length) return false;
		for (let i = 0; i < wa.length; i++) {
			const ca = wa[i];
			const cb = wb[i];
			if (!Array.isArray(ca) || !Array.isArray(cb) || ca.length !== cb.length) return false;
			for (let j = 0; j < ca.length; j++) {
				if (ca[j] !== cb[j]) return false;
			}
		}
	}
	return true;
}
