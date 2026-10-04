// Generated demonstrations use catalog IDs and exact engine builds. They are
// not attested examples and never replace the shared examples catalog.
function exactBuild(ids, presetsById, buildWord) {
	if (!ids.length || ids.some((id) => !presetsById.has(id))) return null;
	try {
		const built = buildWord(ids.flatMap((id) => presetsById.get(id).seq));
		return built?.ok && built.closed && !built.approximate ? built : null;
	} catch { return null; }
}

export function inflectionExamples(presetsById, buildWord) {
	return ["neri", "qimmeq"].flatMap((id) => {
		const stem = presetsById.get(id);
		if (!stem) return [];
		const forms = [];
		for (const ending of presetsById.values()) {
			const f = ending.seq?.[0]?.inflection;
			if (ending.morpheme_type !== "inflectional_ending" || !f) continue;
			const suitable = stem.word_class === "V"
				? f.mood === "indicative" && f.transitivity === "intransitive" && (f.polarity ?? "positive") === "positive" && f.subject
				: stem.word_class === "N" && f.case === "absolutive" && f.number && Object.hasOwn(f, "possessor") && !f.possessor;
			if (!suitable) continue;
			const built = exactBuild([id, ending.id], presetsById, buildWord);
			if (built && !forms.includes(built.word)) forms.push(built.word);
			if (forms.length === 3) break;
		}
		return forms.length > 1 ? [{ id, wordClass: stem.word_class, forms }] : [];
	});
}

export function contrastSuggestions(ids, presetsById, buildWord) {
	const original = exactBuild(ids, presetsById, buildWord);
	if (!original) return [];
	const endingIndex = ids.findLastIndex((id) => presetsById.get(id)?.morpheme_type === "inflectional_ending");
	if (endingIndex < 0) return [];
	const ending = presetsById.get(ids[endingIndex]);
	const features = ending.seq?.[0]?.inflection;
	const suggestions = [];
	const add = (next, reason) => {
		const built = exactBuild(next, presetsById, buildWord);
		if (!built || built.word === original.word || suggestions.some((s) => s.surface === built.word)) return;
		suggestions.push({ ids: next, surface: built.word, reason });
	};
	for (const candidate of presetsById.values()) {
		if (candidate.morpheme_type !== "inflectional_ending") continue;
		const f = candidate.seq?.[0]?.inflection;
		if (!features || !f) continue;
		let reason;
		if (features.subject && f.subject && features.mood === f.mood && features.transitivity === f.transitivity
			&& (features.polarity ?? "positive") === (f.polarity ?? "positive")
			&& JSON.stringify(features.object ?? null) === JSON.stringify(f.object ?? null)
			&& JSON.stringify(features.subject) !== JSON.stringify(f.subject)) reason = "contrastChangeSubject";
		else if (features.case && features.case === f.case && features.number !== f.number
			&& JSON.stringify(features.possessor ?? null) === JSON.stringify(f.possessor ?? null)) reason = "contrastChangeNumber";
		if (!reason) continue;
		const next = ids.slice(); next[endingIndex] = candidate.id; add(next, reason);
		if (suggestions.length === 2) break;
	}
	if (features?.subject && presetsById.has("V_ngngit_Vb")) {
		const next = ids.slice();
		const negation = next.indexOf("V_ngngit_Vb");
		if (negation >= 0) next.splice(negation, 1);
		else next.splice(endingIndex, 0, "V_ngngit_Vb");
		add(next, "contrastChangeNegation");
	}
	return suggestions;
}
