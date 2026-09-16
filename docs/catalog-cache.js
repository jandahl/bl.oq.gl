export const CATALOG_CACHE_NAME = "bloq-catalog-v1";
export const CATALOG_META_URL = "https://bloq.invalid/catalog-meta";

export function catalogUnchanged(meta, headers = {}) {
	if (!meta) return false;
	const etag = header(headers, "etag");
	if (meta.etag && etag) return meta.etag === etag;
	const lastModified = header(headers, "last-modified") || header(headers, "lastModified");
	if (meta.lastModified && lastModified) return meta.lastModified === lastModified;
	return false;
}

function header(headers, name) {
	if (!headers) return "";
	if (typeof headers.get === "function") return headers.get(name) || headers.get(name.toLowerCase()) || "";
	return headers[name] || headers[name.toLowerCase()] || "";
}

export function concatBytes(chunks) {
	const size = chunks.reduce((n, chunk) => n + chunk.byteLength, 0);
	const out = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}

export async function readBufferWithProgress(response, onProgress) {
	const total = Number(response.headers?.get?.("content-length")) || 0;
	if (!response.body?.getReader) {
		const buffer = new Uint8Array(await response.arrayBuffer());
		onProgress?.({ phase: "parse", loaded: buffer.byteLength, total: total || buffer.byteLength });
		return buffer;
	}
	const reader = response.body.getReader();
	const chunks = [];
	let loaded = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		loaded += value.byteLength;
		onProgress?.({ phase: "download", loaded, total });
	}
	const buffer = concatBytes(chunks);
	onProgress?.({ phase: "parse", loaded: buffer.byteLength, total: total || buffer.byteLength });
	return buffer;
}

export function parseCatalogBytes(buffer) {
	return JSON.parse(new TextDecoder().decode(buffer));
}

export function createMemoryHttpCache() {
	const map = new Map();
	return {
		async match(url) {
			const hit = map.get(String(url));
			return hit ? hit.clone() : undefined;
		},
		async put(url, response) {
			map.set(String(url), response.clone());
		},
	};
}

export async function openCatalogCache() {
	try {
		if (typeof caches !== "undefined") return await caches.open(CATALOG_CACHE_NAME);
	} catch {
		// Private mode / missing Cache Storage — fall through to memory.
	}
	return createMemoryHttpCache();
}

export async function readCatalogMeta(cache) {
	try {
		const res = await cache.match(CATALOG_META_URL);
		if (!res) return null;
		const meta = await res.json();
		return meta && typeof meta === "object" ? meta : null;
	} catch {
		return null;
	}
}

export async function writeCatalogMeta(cache, meta) {
	await cache.put(
		CATALOG_META_URL,
		new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } }),
	);
}

export function catalogResponseFromBuffer(buffer, meta = {}) {
	const headers = { "content-type": "application/json", "content-length": String(buffer.byteLength) };
	if (meta.etag) headers.etag = meta.etag;
	if (meta.lastModified) headers["last-modified"] = meta.lastModified;
	return new Response(buffer, { status: 200, headers });
}
