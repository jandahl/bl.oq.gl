/** Fixture mergeMorphemeSources for Node unit tests — no network. */
export function fixtureMergeMorphemeSources(results) {
	const value = results?.[0]?.value;
	if (!value) return { presets: [], anyOk: false, failed: ["empty"] };
	if (Array.isArray(value.presets)) {
		return { presets: value.presets.map((p) => ({ ...p, plainGloss: { ...(p.plainGloss ?? {}) } })), anyOk: true, failed: [] };
	}
	const presets = [];
	for (const [id, entries] of Object.entries(value.by_id || {})) {
		const entry = Array.isArray(entries) ? entries[0] : entries;
		if (!entry) continue;
		const form = entry.application_logic?.underlying_form ?? id;
		const facts = entry.lexical_facts ?? {};
		const plain = entry.plain_gloss ?? {};
		presets.push({
			id,
			expected: form,
			underlyingForm: form,
			morpheme_type: facts.morpheme_type,
			word_class: facts.word_class || "",
			glossShort: facts.meaning || "",
			plainGloss: {
				en_short: plain.en_short ?? plain.en,
				da_short: plain.da_short ?? plain.da,
			},
			seq: [{ id, text: form }],
		});
	}
	return { presets, anyOk: presets.length > 0, failed: [] };
}
