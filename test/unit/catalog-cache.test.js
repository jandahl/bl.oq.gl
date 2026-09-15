import test from "node:test";
import assert from "node:assert/strict";
import {
	catalogUnchanged,
	concatBytes,
	createMemoryHttpCache,
	parseCatalogBytes,
	readBufferWithProgress,
	readCatalogMeta,
	writeCatalogMeta,
} from "../../docs/catalog-cache.js";

test("catalogUnchanged matches on etag first, then last-modified", () => {
	assert.equal(catalogUnchanged(null, { etag: "abc" }), false);
	assert.equal(catalogUnchanged({ etag: '"a"' }, { etag: '"a"' }), true);
	assert.equal(catalogUnchanged({ etag: '"a"' }, { etag: '"b"' }), false);
	assert.equal(catalogUnchanged({ lastModified: "Tue, 15 Sep 2026 13:48:06 GMT" }, { lastModified: "Tue, 15 Sep 2026 13:48:06 GMT" }), true);
	assert.equal(catalogUnchanged({ lastModified: "Tue, 15 Sep 2026 13:48:06 GMT" }, { "last-modified": "Wed, 16 Sep 2026 00:00:00 GMT" }), false);
});

test("readBufferWithProgress reports download bytes then parse", async () => {
	const body = new TextEncoder().encode('{"ok":true}');
	const response = new Response(body, { headers: { "content-length": String(body.byteLength) } });
	const events = [];
	const buffer = await readBufferWithProgress(response, (event) => events.push(event));
	assert.equal(parseCatalogBytes(buffer).ok, true);
	assert.ok(events.some((event) => event.phase === "download"));
	assert.equal(events.at(-1).phase, "parse");
	assert.equal(events.at(-1).loaded, body.byteLength);
});

test("concatBytes joins streamed chunks in order", () => {
	const joined = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3])]);
	assert.deepEqual([...joined], [1, 2, 3]);
});

test("memory catalog cache round-trips payload and meta", async () => {
	const cache = createMemoryHttpCache();
	await writeCatalogMeta(cache, { etag: '"x"', url: "https://example.test/m.json" });
	const meta = await readCatalogMeta(cache);
	assert.equal(meta.etag, '"x"');
	await cache.put("https://example.test/m.json", new Response('{"n":1}', { headers: { "content-type": "application/json" } }));
	const hit = await cache.match("https://example.test/m.json");
	assert.deepEqual(await hit.json(), { n: 1 });
});
