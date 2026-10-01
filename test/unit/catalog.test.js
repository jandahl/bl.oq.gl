import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { applyCatalogCompatibility, catalogFromPayload, loadCatalog } from "../../docs/catalog.js";
import { createMemoryHttpCache, writeCatalogMeta } from "../../docs/catalog-cache.js";
import { fixtureMergeMorphemeSources } from "../helpers/catalog-fixture.js";

const root = dirname(fileURLToPath(import.meta.url));
const mini = JSON.parse(readFileSync(join(root, "../../docs/fixtures/catalog-mini.json"), "utf8"));

test("catalogFromPayload requires an injected merge (no live oq-api import)", () => {
	assert.throws(() => catalogFromPayload(mini), /mergeMorphemeSources/);
});

test("catalogFromPayload: fixture mini catalog yields presets without network", () => {
	const { presets, authoritative, meta } = catalogFromPayload(mini, fixtureMergeMorphemeSources);
	assert.equal(authoritative, false);
	assert.equal(meta.status, "fixture");
	assert.ok(presets.length >= 5);
	assert.ok(presets.some((p) => p.id === "qimmeq"));
	const negator = presets.find((p) => p.id === "V_ngngit_Vb");
	assert.ok(negator);
	assert.match(negator.plainGloss.en_short, /do not/);
});

test("applyCatalogCompatibility: legacy negator gloss is patched", () => {
	const legacy = [{
		id: "V_ngngit_Vb",
		expected: "-nngit",
		plainGloss: { en_short: "negation, ___ not" },
	}];
	applyCatalogCompatibility(legacy);
	assert.equal(legacy[0].plainGloss.en_short, "do not ___");
});

test("applyCatalogCompatibility: modern negator gloss is left alone", () => {
	const modern = [{
		id: "V_ngngit_Vb",
		expected: "-nngit",
		plainGloss: { en_short: "do not ___ (ordinary negator)" },
	}];
	applyCatalogCompatibility(modern);
	assert.equal(modern[0].plainGloss.en_short, "do not ___ (ordinary negator)");
});

test("catalogFromPayload + fixture merge: build-shaped seq is present for stems", () => {
	const { presets } = catalogFromPayload(mini, fixtureMergeMorphemeSources);
	const dog = presets.find((p) => p.id === "qimmeq");
	assert.equal(dog.seq[0].id, "qimmeq");
	assert.equal(dog.seq[0].text, "qimmeq");
});

test("loadCatalog deletes a corrupt cache entry and loads from the network", async () => {
	const url = "https://example.test/morphemes-by-id.json";
	const cache = createMemoryHttpCache();
	await cache.put(url, new Response("not json"));
	await writeCatalogMeta(cache, { url, etag: "bad" });
	const original = globalThis.fetch;
	globalThis.fetch = async () => new Response(JSON.stringify(mini), {
		status: 200,
		headers: { etag: "good", "content-type": "application/json" },
	});
	try {
		const catalog = await loadCatalog({
			cache,
			urls: [url],
			engine: { mergeMorphemeSources: fixtureMergeMorphemeSources, GRAMMAR_MORPHEMES_URL: url },
		});
		assert.equal(catalog.fromCache, false);
		assert.ok(catalog.presets.some((preset) => preset.id === "qimmeq"));
		const stored = await cache.match(url);
		assert.match(await stored.text(), /qimmeq/);
		const meta = await (await cache.match("https://bloq.invalid/catalog-meta")).json();
		assert.equal(meta.etag, "good");
		assert.equal(meta.url, url);
	} finally {
		globalThis.fetch = original;
	}
});

test("loadCatalog revalidation keeps the previous cache when the new body fails to merge", async () => {
	const url = "https://example.test/morphemes-by-id.json";
	const cache = createMemoryHttpCache();
	await cache.put(url, new Response(JSON.stringify(mini), {
		status: 200,
		headers: { etag: "good", "content-type": "application/json" },
	}));
	await writeCatalogMeta(cache, { url, etag: "good" });
	const original = globalThis.fetch;
	let updates = 0;
	globalThis.fetch = async (_url, init) => {
		if (init?.method === "HEAD") {
			return new Response(null, { status: 200, headers: { etag: "changed" } });
		}
		return new Response("{}", {
			status: 200,
			headers: { etag: "changed", "content-type": "application/json" },
		});
	};
	try {
		const catalog = await loadCatalog({
			cache,
			urls: [url],
			onUpdated: () => { updates += 1; },
			engine: { mergeMorphemeSources: fixtureMergeMorphemeSources, GRAMMAR_MORPHEMES_URL: url },
		});
		assert.equal(catalog.fromCache, true);
		assert.ok(catalog.presets.some((preset) => preset.id === "qimmeq"));
		for (let i = 0; i < 10; i++) await new Promise((resolve) => queueMicrotask(resolve));
		assert.equal(updates, 0);
		const stored = await cache.match(url);
		assert.match(await stored.text(), /qimmeq/);
		const meta = await (await cache.match("https://bloq.invalid/catalog-meta")).json();
		assert.equal(meta.etag, "good");
	} finally {
		globalThis.fetch = original;
	}
});
