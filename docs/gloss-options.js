const LANGUAGES = ["en", "da"];

/**
 * Resolve dictionary gloss options for lexical stems in analyzed sequences.
 * The API does not expose a shared ID between dictionary entries and grammar
 * stems, so only one exact headword + word-class match is accepted.
 */
export async function lookupGlossOptions(sequences, { sources, searchEntries, stemWordClass, presetsById }) {
	const roots = new Map();
	for (const seq of sequences ?? []) {
		const root = seq?.[0];
		const preset = root?.id ? presetsById.get(root.id) : null;
		if (preset?.morpheme_type === "stem" && root?.text && ["N", "V"].includes(preset.word_class)) {
			roots.set(root.id, { text: root.text, wordClass: preset.word_class });
		}
	}
	const found = new Map();
	await Promise.all([...roots].map(async ([id, root]) => {
		try {
			const response = await searchEntries(sources, root.text, { lang: "kl", match: "exact" });
			const exact = (response.results ?? []).filter((entry) => normalize(entry.surface) === normalize(root.text)
				&& stemWordClass(entry.desc) === root.wordClass);
			if (exact.length !== 1) return;
			const entry = exact[0];
			const options = Object.fromEntries(LANGUAGES.map((lang) => [lang,
				[...new Set((entry.gloss_options?.[lang] ?? []).map((option) => String(option).trim()).filter(Boolean))],
			]));
			if (LANGUAGES.some((lang) => options[lang].length)) found.set(id, options);
		} catch {
			// Dictionary availability must not block a verified morphological analysis.
		}
	}));
	return found;
}

function normalize(value) {
	return String(value ?? "").normalize("NFC").trim().toLocaleLowerCase("kl");
}
