/**
 * Shared examples catalog schema helpers (no network / oq-api import).
 *
 * Contract: `standard-examples/v1` — `{ worked, sentences }` from oq-api.
 * Worked rows are organic single-word deconstructs. `sentences` may be empty.
 * `gloss` is an EN string or `{ en?, da?, kl? }` (see oq-api `glossText`).
 */

/** @typedef {string | { en?: string, da?: string, kl?: string }} ExampleGloss */

/**
 * @typedef {object} ExampleItem
 * @property {string} id
 * @property {string} surface
 * @property {ExampleGloss} [gloss]
 * @property {string} [gloss_en]
 * @property {string} [gloss_da]
 * @property {string[]} [words]
 * @property {string[]} [chain]
 * @property {string[]} [tags]
 * @property {'words' | 'sentences'} kind
 */

/**
 * @typedef {{ worked: ExampleItem[], sentences: ExampleItem[], schema_version?: string }} ExamplesCatalog
 */

export const STANDARD_EXAMPLES_SCHEMA = "standard-examples/v1";

/**
 * Locale parts for a gloss (string or `{ en, da, kl }`). Matches oq-api `glossLocales`.
 * @param {ExampleGloss | undefined} gloss
 * @returns {{ en: string, da: string, kl: string }}
 */
export function glossLocales(gloss) {
	if (gloss && typeof gloss === "object") {
		return {
			en: typeof gloss.en === "string" ? gloss.en : "",
			da: typeof gloss.da === "string" ? gloss.da : "",
			kl: typeof gloss.kl === "string" ? gloss.kl : "",
		};
	}
	const text = typeof gloss === "string" ? gloss : "";
	return { en: text, da: "", kl: "" };
}

/**
 * Prefer a locale; fall back across en → da → kl. Matches oq-api `glossText`.
 * @param {ExampleGloss | undefined} gloss
 * @param {'en' | 'da' | 'kl'} [locale]
 */
export function glossText(gloss, locale = "en") {
	const parts = glossLocales(gloss);
	if (locale === "da") return parts.da || parts.en || parts.kl;
	if (locale === "kl") return parts.kl || parts.en || parts.da;
	return parts.en || parts.da || parts.kl;
}

/**
 * @param {unknown} raw
 * @returns {ExamplesCatalog}
 */
export function normalizeExamplesCatalog(raw) {
	const src = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
	const workedIn = Array.isArray(src.worked) ? src.worked : [];
	const sentencesIn = Array.isArray(src.sentences) ? src.sentences : [];
	const schema_version = typeof src.schema_version === "string" ? src.schema_version : undefined;
	return {
		...(schema_version ? { schema_version } : {}),
		worked: workedIn.map((item) => normalizeItem(item, "words")),
		sentences: sentencesIn.map((item) => normalizeItem(item, "sentences")),
	};
}

/**
 * Pre-v1 oq-api pins still ship attested multi-word `sentences`. The shared
 * v1 contract keeps that array empty — drop them so BLOQ never treats the
 * legacy list as product source of truth.
 * @param {unknown} raw
 */
export function adaptLegacyExamplesCatalog(raw) {
	const src = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
	if (src.schema_version === STANDARD_EXAMPLES_SCHEMA) {
		return normalizeExamplesCatalog(raw);
	}
	return normalizeExamplesCatalog({
		...src,
		schema_version: undefined,
		worked: Array.isArray(src.worked) ? src.worked : [],
		sentences: [],
	});
}

/**
 * A payload is v1 only when it says so. Anything else is the legacy pin:
 * attested `sentences` are dropped.
 * @param {unknown} raw
 */
export function shapeExamplesPayload(raw) {
	const src = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
	if (src.schema_version === STANDARD_EXAMPLES_SCHEMA) return normalizeExamplesCatalog(raw);
	return adaptLegacyExamplesCatalog(raw);
}

/**
 * Examples load decision, with fetch and the pin injected so unit tests
 * never import oq-api.js.
 *
 * An override URL is authoritative: a 404 or bad payload throws instead of
 * falling through to the live catalog. The pin is v1 only when its schema
 * constant is `standard-examples/v1` — exporting glossText is not enough.
 * The payload itself is still shaped by its own schema_version.
 *
 * @param {{
 *   override?: string|null,
 *   pinSchema?: string|null,
 *   fetchCatalog: (url: string) => Promise<ExamplesCatalog|null>,
 *   getStandardExamples: () => Promise<unknown>,
 *   remoteUrls?: Array<string|null|undefined>,
 * }} args
 * @returns {Promise<{ catalog: ExamplesCatalog, source: "remote"|"oq-api" }>}
 */
export async function resolveExamplesCatalog({
	override = null,
	pinSchema = null,
	fetchCatalog,
	getStandardExamples,
	remoteUrls = [],
}) {
	if (override) {
		const catalog = await fetchCatalog(override);
		if (!catalog) throw new Error(`Examples override failed: ${override}`);
		return { catalog, source: "remote" };
	}

	if (pinSchema === STANDARD_EXAMPLES_SCHEMA) {
		try {
			const local = await getStandardExamples();
			return { catalog: shapeExamplesPayload(local), source: "oq-api" };
		} catch {
			/* CDN, then the versioned pin JSON */
		}
	}

	for (const url of remoteUrls) {
		if (!url) continue;
		const catalog = await fetchCatalog(url);
		if (catalog) return { catalog, source: "remote" };
	}

	const local = await getStandardExamples();
	return { catalog: shapeExamplesPayload(local), source: "oq-api" };
}

/**
 * @param {unknown} item
 * @param {'words' | 'sentences'} kind
 * @returns {ExampleItem}
 */
function normalizeItem(item, kind) {
	const row = item && typeof item === "object" ? /** @type {Record<string, unknown>} */ (item) : {};
	const glossEnField = typeof row.gloss_en === "string" ? row.gloss_en : "";
	const glossDaField = typeof row.gloss_da === "string" ? row.gloss_da : "";
	/** @type {ExampleGloss | undefined} */
	let gloss = undefined;
	if (typeof row.gloss === "string" || (row.gloss && typeof row.gloss === "object")) {
		gloss = /** @type {ExampleGloss} */ (row.gloss);
	} else if (glossEnField || glossDaField) {
		gloss = { en: glossEnField, da: glossDaField };
	}
	const locales = glossLocales(gloss);
	const gloss_en = locales.en || glossEnField;
	const gloss_da = locales.da || glossDaField;

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
			gloss_en,
			gloss_da,
			tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
			kind: "sentences",
		};
	}
	const surface = typeof row.surface === "string" ? row.surface : "";
	return {
		id: typeof row.id === "string" && row.id ? row.id : surface || "word",
		surface,
		gloss,
		gloss_en,
		gloss_da,
		chain: Array.isArray(row.chain) ? row.chain.map(String) : undefined,
		tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
		kind: "words",
	};
}

/**
 * Display gloss for an example item. Uses oq-api-compatible `glossText` on the
 * raw `gloss` field, with legacy gloss_en / gloss_da fallbacks.
 * @param {ExampleItem} item
 * @param {'en' | 'da' | 'kl'} [locale]
 * @param {(gloss: ExampleGloss | undefined, locale?: string) => string} [glossTextFn]
 */
export function glossForExample(item, locale = "en", glossTextFn = glossText) {
	const fromFn = typeof glossTextFn === "function" ? glossTextFn(item.gloss, locale) : "";
	if (fromFn) return fromFn;
	if (locale === "da") return item.gloss_da || item.gloss_en || "";
	return item.gloss_en || item.gloss_da || "";
}


/** Rolling CDN from oq-api docs (api.oq.gl#337). 404 until that PR publishes. */
export const EXAMPLES_CDN_URL =
	"https://jandahl.github.io/api.oq.gl/examples/standard-examples.json";

/**
 * Immutable freeze path next to a pinned public-api.js URL.
 * @param {string} [apiUrl]
 * @returns {string | null}
 */
export function examplesVersionedUrl(apiUrl) {
	// Pins look like https://jandahl.github.io/api.oq.gl/api/v0.3.61/public-api.js
	const match = String(apiUrl || "").match(/^(https?:\/\/.+\/api\/v[^/]+)\//);
	if (!match) return null;
	return `${match[1]}/standard-examples.json`;
}
