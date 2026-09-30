/**
 * Shared examples catalog schema helpers (no network / oq-api import).
 *
 * Expected shape (Misiliineq + future oq-api upstream JSON):
 * `{ worked: ExampleItem[], sentences: ExampleItem[] }`
 * where each item has `id?`, `surface` or `words[]`, and optional
 * `gloss` / `gloss_en` / `gloss_da` / `chain` / `tags`.
 */

/**
 * @typedef {object} ExampleItem
 * @property {string} id
 * @property {string} surface
 * @property {string} [gloss]
 * @property {string} [gloss_en]
 * @property {string} [gloss_da]
 * @property {string[]} [words]
 * @property {string[]} [chain]
 * @property {string[]} [tags]
 * @property {'words' | 'sentences'} kind
 */

/**
 * @typedef {{ worked: ExampleItem[], sentences: ExampleItem[] }} ExamplesCatalog
 */

/**
 * @param {unknown} raw
 * @returns {ExamplesCatalog}
 */
export function normalizeExamplesCatalog(raw) {
	const src = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
	const workedIn = Array.isArray(src.worked) ? src.worked : [];
	const sentencesIn = Array.isArray(src.sentences) ? src.sentences : [];
	return {
		worked: workedIn.map((item) => normalizeItem(item, "words")),
		sentences: sentencesIn.map((item) => normalizeItem(item, "sentences")),
	};
}

/**
 * @param {unknown} item
 * @param {'words' | 'sentences'} kind
 * @returns {ExampleItem}
 */
function normalizeItem(item, kind) {
	const row = item && typeof item === "object" ? /** @type {Record<string, unknown>} */ (item) : {};
	const glossEn = typeof row.gloss_en === "string" ? row.gloss_en : "";
	const glossDa = typeof row.gloss_da === "string" ? row.gloss_da : "";
	const gloss = typeof row.gloss === "string" ? row.gloss : glossEn || glossDa;
	if (kind === "sentences") {
		const words = Array.isArray(row.words)
			? row.words.map((w) => String(w)).filter(Boolean)
			: String(row.surface || "")
				.split(/\s+/)
				.filter(Boolean);
		const surface = words.join(" ");
		return {
			id: typeof row.id === "string" && row.id ? row.id : surface || "sentence",
			surface,
			words,
			gloss,
			gloss_en: glossEn || gloss,
			gloss_da: glossDa,
			tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
			kind: "sentences",
		};
	}
	const surface = typeof row.surface === "string" ? row.surface : "";
	return {
		id: typeof row.id === "string" && row.id ? row.id : surface || "word",
		surface,
		gloss,
		gloss_en: glossEn || gloss,
		gloss_da: glossDa,
		chain: Array.isArray(row.chain) ? row.chain.map(String) : undefined,
		tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
		kind: "words",
	};
}

/**
 * @param {ExampleItem} item
 * @param {'en' | 'da'} [locale]
 */
export function glossForExample(item, locale = "en") {
	if (locale === "da") return item.gloss_da || item.gloss || item.gloss_en || "";
	return item.gloss_en || item.gloss || item.gloss_da || "";
}
