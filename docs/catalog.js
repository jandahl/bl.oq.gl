// Fetches the published grammarian morpheme catalog and converts it into the
// preset shape oq's buildWord()/analyzeWord() expect. See
// oq-grammarian's CLAUDE.md — the exported JSON always
// carries meta.authoritative: false, which we surface to the user as-is
// rather than hiding it.
//
// The catalog is ~9 MB. Cache Storage keeps the last good payload so a
// return visit can parse locally instead of waiting on the network; a
// background HEAD/GET then refreshes it when the ETag changes.
//
// catalogFromPayload is pure given an injected mergeMorphemeSources — Node
// unit tests pass a fixture merge and never import oq-api.js (which would
// pull the live engine). loadCatalog lazy-loads the engine when callers do
// not inject one.
import {
	catalogResponseFromBuffer,
	catalogUnchanged,
	digestCatalog,
	openCatalogCache,
	parseCatalogBytes,
	readBufferWithProgress,
	readCatalogMeta,
	writeCatalogMeta,
	CATALOG_META_URL,
} from "./catalog-cache.js";
import { raceCatalogResponses } from "./catalog-fetch.js";

// GitHub Actions runners cannot reach the Cloudflare Pages host reliably.
// This is the published mirror of the same grammarian catalog. Both hosts
// are fetched together: the oq-api URL still wins when it answers within a
// few seconds, and a hung primary is aborted so the mirror can proceed.
export const GRAMMAR_MORPHEMES_FALLBACK_URL =
	"https://jandahl.github.io/oq-grammarian/v2/grammar/morphemes-by-id.json";

/**
 * Compatibility for grammarian mirrors published before the structured
 * negation gloss: keep the ordinary negator learner-facing label stable.
 * @param {any[]} presets
 * @returns {any[]}
 */
export function applyCatalogCompatibility(presets) {
	const negator = presets.find((preset) => preset.id === "V_ngngit_Vb"
		|| preset.expected === "-nngit"
		|| preset.underlyingForm === "-nngit");
	if (negator && !negator.plainGloss?.en_short?.includes?.("do not")) {
		negator.plainGloss = { ...(negator.plainGloss ?? {}), en_short: "do not ___" };
	}
	return presets;
}

/**
 * @param {any} value
 * @param {(results: any[], filters: any[]) => { presets: any[], anyOk: boolean, failed: any[] }} mergeMorphemeSources
 * @returns {{ presets: any[], authoritative: boolean|undefined, meta: any }}
 */
export function catalogFromPayload(value, mergeMorphemeSources) {
	if (typeof mergeMorphemeSources !== "function") {
		throw new TypeError("catalogFromPayload requires mergeMorphemeSources");
	}
	const { presets, anyOk, failed } = mergeMorphemeSources(
		[{ status: "fulfilled", value }],
		[{ buildable: true, source: "grammarian" }],
	);
	if (!anyOk || failed.length) throw new Error("morpheme catalog failed to load");
	applyCatalogCompatibility(presets);
	return { presets, authoritative: value?.meta?.authoritative, meta: value?.meta ?? null };
}

async function fetchCatalogBuffer(url, onProgress, fetchInit = {}) {
	const candidates = (Array.isArray(url) ? url : [url]).filter(Boolean);
	const request = { credentials: "omit", ...fetchInit };
	let response;
	let winner = candidates[0];
	if (candidates.length <= 1) {
		try {
			response = await fetch(winner, request);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
		} catch (error) {
			throw new Error(`morpheme catalog fetch failed (${winner}: ${error.message})`);
		}
	} else {
		const raced = await raceCatalogResponses(candidates, fetchInit.cache ? { cache: fetchInit.cache } : {});
		response = raced.response;
		winner = raced.url;
	}
	const buffer = await readBufferWithProgress(response, onProgress);
	return {
		buffer,
		url: winner,
		meta: {
			etag: response.headers.get("etag") || "",
			lastModified: response.headers.get("last-modified") || "",
			fetchedAt: Date.now(),
		},
	};
}

async function persistCatalog(cache, url, buffer, meta) {
	try {
		await cache.put(url, catalogResponseFromBuffer(buffer, meta));
		await writeCatalogMeta(cache, { ...meta, url });
	} catch {
		// Quota or private-mode failures must not block using the in-memory catalog.
	}
}

async function revalidateCatalog(url, cache, meta, onUpdated, mergeMorphemeSources) {
	try {
		const head = await fetch(url, { method: "HEAD", cache: "no-cache", credentials: "omit" });
		const headers = {
			etag: head.ok ? head.headers.get("etag") || "" : "",
			lastModified: head.ok ? head.headers.get("last-modified") || "" : "",
		};
		if (head.ok && catalogUnchanged(meta, headers)) {
			await writeCatalogMeta(cache, { ...meta, ...headers, fetchedAt: Date.now(), url });
			return;
		}
		const fresh = await fetchCatalogBuffer(url, undefined, { cache: "no-cache" });
		const sha256 = await digestCatalog(fresh.buffer);
		// A hidden ETag makes catalogUnchanged return false. Matching bytes
		// are still the same catalog: do not parse, notify, or rewrite the body.
		if (meta?.sha256 && meta.sha256 === sha256) {
			await writeCatalogMeta(cache, {
				...meta,
				sha256,
				fetchedAt: Date.now(),
				url: fresh.url || url,
				...(fresh.meta.etag ? { etag: fresh.meta.etag } : {}),
				...(fresh.meta.lastModified ? { lastModified: fresh.meta.lastModified } : {}),
			});
			return;
		}
		const value = parseCatalogBytes(fresh.buffer);
		// Validate before replacing the last good entry. A body that parses
		// but fails the merge must not become the next visit's cache.
		const catalog = catalogFromPayload(value, mergeMorphemeSources);
		await persistCatalog(cache, url, fresh.buffer, { ...fresh.meta, sha256 });
		onUpdated?.(catalog);
	} catch {
		// Keep the cached catalog; the next visit will try again.
	}
}

/**
 * @param {{
 *   onProgress?: (event: { phase: string, loaded?: number, total?: number }) => void,
 *   onUpdated?: (catalog: any) => void,
 *   engine?: { mergeMorphemeSources: Function, GRAMMAR_MORPHEMES_URL: string },
 *   urls?: string[],
 *   cache?: { match: Function, put: Function, delete: Function },
 * }} [opts]
 * @returns {Promise<{ presets: any[], authoritative: boolean|undefined, meta: any, fromCache: boolean }>}
 */
export async function loadCatalog(opts = {}) {
	const { onProgress, onUpdated } = opts;
	const engine = opts.engine ?? await import("./oq-api.js");
	const mergeMorphemeSources = engine.mergeMorphemeSources;
	const overrideUrls = opts.urls ?? globalThis.__BLOQ_CATALOG_URLS__;
	const urls = (Array.isArray(overrideUrls) && overrideUrls.length)
		? overrideUrls
		: [engine.GRAMMAR_MORPHEMES_URL, GRAMMAR_MORPHEMES_FALLBACK_URL];
	const cache = opts.cache ?? await openCatalogCache();
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
		try {
			onProgress?.({ phase: "cached" });
			const buffer = new Uint8Array(await cached.arrayBuffer());
			onProgress?.({ phase: "parse", loaded: buffer.byteLength, total: buffer.byteLength });
			// Old entries have no sha256. Digest the bytes already in hand so a
			// hidden ETag cannot force a parse and onUpdated of an unchanged body.
			const sha256 = meta?.sha256 || await digestCatalog(buffer);
			const seeded = { ...meta, sha256, url: meta?.url || cachedUrl };
			if (meta?.sha256 !== sha256) await writeCatalogMeta(cache, seeded);
			const catalog = { ...catalogFromPayload(parseCatalogBytes(buffer), mergeMorphemeSources), fromCache: true };
			queueMicrotask(() => {
				revalidateCatalog(cachedUrl, cache, seeded, onUpdated, mergeMorphemeSources);
			});
			return catalog;
		} catch {
			// A truncated or unpinable payload must not brick the next visit.
			// Cache Storage is not keyed by the oq-api pin.
			try {
				if (cachedUrl) await cache.delete(cachedUrl);
				await cache.delete(CATALOG_META_URL);
			} catch {
				// Still try the network.
			}
		}
	}

	const fresh = await fetchCatalogBuffer(urls, onProgress);
	const sha256 = await digestCatalog(fresh.buffer);
	const catalog = { ...catalogFromPayload(parseCatalogBytes(fresh.buffer), mergeMorphemeSources), fromCache: false };
	await persistCatalog(cache, fresh.url, fresh.buffer, { ...fresh.meta, sha256 });
	return catalog;
}
