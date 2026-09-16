// Fetches the published grammarian morpheme catalog and converts it into the
// preset shape oq's buildWord()/analyzeWord() expect. See
// oq-grammarian's CLAUDE.md — the exported JSON always
// carries meta.authoritative: false, which we surface to the user as-is
// rather than hiding it.
//
// The catalog is ~9 MB. Cache Storage keeps the last good payload so a
// return visit can parse locally instead of waiting on the network; a
// background HEAD/GET then refreshes it when the ETag changes.
import { mergeMorphemeSources, GRAMMAR_MORPHEMES_URL } from "./oq-api.js";
import {
	catalogResponseFromBuffer,
	catalogUnchanged,
	openCatalogCache,
	parseCatalogBytes,
	readBufferWithProgress,
	readCatalogMeta,
	writeCatalogMeta,
} from "./catalog-cache.js";

// GitHub Actions runners cannot reach the Cloudflare Pages host reliably. This
// is the published mirror of the same grammarian catalog. Prefer it for the
// browser because the Cloudflare Pages host can hang for end users and CI;
// retain the oq-api URL as a secondary compatibility fallback.
export const GRAMMAR_MORPHEMES_FALLBACK_URL =
	"https://jandahl.github.io/oq-grammarian/v2/grammar/morphemes-by-id.json";

/**
 * @param {any} value
 * @returns {{ presets: any[], authoritative: boolean|undefined, meta: any }}
 */
export function catalogFromPayload(value) {
	const { presets, anyOk, failed } = mergeMorphemeSources(
		[{ status: "fulfilled", value }],
		[{ buildable: true, source: "grammarian" }],
	);
	if (!anyOk || failed.length) throw new Error("morpheme catalog failed to load");
	// Compatibility for grammarian mirrors published before the structured
	// negation gloss: keep the ordinary negator learner-facing label stable.
	const negator = presets.find((preset) => preset.id === "V_ngngit_Vb"
		|| preset.expected === "-nngit"
		|| preset.underlyingForm === "-nngit");
	if (negator && !negator.plainGloss?.en_short?.includes?.("do not")) {
		negator.plainGloss = { ...(negator.plainGloss ?? {}), en_short: "do not ___" };
	}
	return { presets, authoritative: value?.meta?.authoritative, meta: value?.meta ?? null };
}

async function fetchCatalogBuffer(url, onProgress) {
	const failures = [];
	for (const candidate of Array.isArray(url) ? url : [url]) {
		try {
			const res = await fetch(candidate, { cache: "no-cache" });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const buffer = await readBufferWithProgress(res, onProgress);
			return {
				buffer,
				url: candidate,
				meta: {
					etag: res.headers.get("etag") || "",
					lastModified: res.headers.get("last-modified") || "",
					fetchedAt: Date.now(),
				},
			};
		} catch (error) {
			failures.push(`${candidate}: ${error.message}`);
		}
	}
	throw new Error(`morpheme catalog fetch failed (${failures.join("; ")})`);
}

async function persistCatalog(cache, url, buffer, meta) {
	try {
		await cache.put(url, catalogResponseFromBuffer(buffer, meta));
		await writeCatalogMeta(cache, { ...meta, url });
	} catch {
		// Quota or private-mode failures must not block using the in-memory catalog.
	}
}

async function revalidateCatalog(url, cache, meta, onUpdated) {
	try {
		const head = await fetch(url, { method: "HEAD", cache: "no-cache" });
		const headers = {
			etag: head.ok ? head.headers.get("etag") || "" : "",
			lastModified: head.ok ? head.headers.get("last-modified") || "" : "",
		};
		if (head.ok && catalogUnchanged(meta, headers)) {
			await writeCatalogMeta(cache, { ...meta, ...headers, fetchedAt: Date.now(), url });
			return;
		}
		const fresh = await fetchCatalogBuffer(url);
		const value = parseCatalogBytes(fresh.buffer);
		await persistCatalog(cache, url, fresh.buffer, fresh.meta);
		onUpdated?.(catalogFromPayload(value));
	} catch {
		// Keep the cached catalog; the next visit will try again.
	}
}

/**
 * @param {{ onProgress?: (event: { phase: string, loaded?: number, total?: number }) => void, onUpdated?: (catalog: any) => void }} [opts]
 * @returns {Promise<{ presets: any[], authoritative: boolean|undefined, meta: any, fromCache: boolean }>}
 */
export async function loadCatalog(opts = {}) {
	const { onProgress, onUpdated } = opts;
	const urls = [GRAMMAR_MORPHEMES_FALLBACK_URL, GRAMMAR_MORPHEMES_URL];
	const cache = await openCatalogCache();
	const meta = await readCatalogMeta(cache);
	let cachedUrl = urls.find((candidate) => meta?.url === candidate);
	let cached = cachedUrl ? await cache.match(cachedUrl) : null;
	if (!cached) {
		for (const candidate of urls) {
			cached = await cache.match(candidate);
			if (cached) {
				cachedUrl = candidate;
				break;
			}
		}
	}

	if (cached) {
		onProgress?.({ phase: "cached" });
		const buffer = new Uint8Array(await cached.arrayBuffer());
		onProgress?.({ phase: "parse", loaded: buffer.byteLength, total: buffer.byteLength });
		const catalog = { ...catalogFromPayload(parseCatalogBytes(buffer)), fromCache: true };
		queueMicrotask(() => {
			revalidateCatalog(cachedUrl, cache, meta, onUpdated);
		});
		return catalog;
	}

	const fresh = await fetchCatalogBuffer(urls, onProgress);
	const catalog = { ...catalogFromPayload(parseCatalogBytes(fresh.buffer)), fromCache: false };
	await persistCatalog(cache, fresh.url, fresh.buffer, fresh.meta);
	return catalog;
}
