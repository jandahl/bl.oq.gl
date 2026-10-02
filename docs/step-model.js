// @ts-check
/** Build every original prefix, including zero forms and failed stages.
 * @param {any[]} seq @param {(seq: any[]) => any} buildWord */
export function derivationStages(seq, buildWord) {
	return seq.map((item, seqIndex) => {
		try { return { item, seqIndex, built: buildWord(seq.slice(0, seqIndex + 1)) }; }
		catch (error) { return { item, seqIndex, built: { ok: false, reason: error instanceof Error ? error.message : String(error) } }; }
	});
}
